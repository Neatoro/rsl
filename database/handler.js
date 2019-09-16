const _ = require('lodash');
const expandedQuery = require('./expandedQuery');
const filteredQuery = require('./filteredQuery');
const knex = require('knex');
const { typeMapping } = require('../util');

function isNativeType(typeName) {
    return _(typeMapping).keys().includes(typeName);
}

class TypeNode {

    constructor(typeDefinition) {
        this.name = typeDefinition.name;
        this.properties = _.map(typeDefinition.properties, (property) => new PropertyNode(property));
        this._resolved = false;
    }

    get selectFields() {
        const fields = [`${this.name}.id`];
        for (const property of this.properties) {
            fields.push(`${this.name}.${property.name}`);
        }
        return fields;
    }

    async resolve(resolver) {
        if (!this._resolved) {
            for (const property of this.properties) {
                if (_.isArray(property.type)) {
                    this._resolveArrayDependency(property, resolver);
                } else if (this._isDependency(property.type)) {
                    await property.type.resolve(resolver);
                }
            }
            resolver(this);
            this._resolved = true;
        }
    }

    _isDependency(type) {
        return !_.isString(type) && type.name !== this.name;
    }

    async _resolveArrayDependency(property, resolver) {
        if (this._isDependency(property.type[0])) {
            await property.type[0].resolve(resolver);
        }
    }
}

class PropertyNode {

    constructor(property) {
        this.name = property.name;
        this.type = property.type;
    }

}

module.exports = class DatabaseHandler {

    constructor({ client, connection }) {
        this.k = knex({
            client,
            connection
        });

        this.types = undefined;
    }

    async createTablesForTypes(typeDefinitions) {
        this.types = typeDefinitions
            .map((typeDefinition) => new TypeNode(typeDefinition))
            .reduce(
                (acc, el) => {
                    acc[el.name] = el;
                    return acc;
                },
                {}
            );

        _(this.types)
            .values()
            .flatMap((type) => type.properties)
            .filter((property) => {
                return !isNativeType(property.type);
            })
            .forEach((property) => {
                if (!_.isArray(property.type)) {
                    property.type = this.types[property.type];
                } else {
                    property.type = isNativeType(property.type[0]) ? property.type : [this.types[property.type[0]]];
                }
            });

        for (const type of _.values(this.types)) {
            await type.resolve(this._createTableForType.bind(this));
        }
    }

    async list({ typeDefinition, filters = [], expands = [], limit = 100, offset = 0}) {
        typeDefinition = this.types[typeDefinition.name];
        const selectFields = [
            `${typeDefinition.name}.id`,
            ..._(typeDefinition.properties)
                .filter((property) => !_.isArray(property.type))
                .map((property) => `${typeDefinition.name}.${property.name}`).value()
        ];

        let baseQuery = this.k(
            function() {
                this.select(selectFields)
                    .from(typeDefinition.name)
                    .limit(limit)
                    .offset(offset)
                    .as(typeDefinition.name)
            }
        )
            .select(selectFields);

        const arrayFields = _.filter(typeDefinition.properties, (property) => _.isArray(property.type));
        for (const arrayField of arrayFields) {
            baseQuery = baseQuery
                .select(`${typeDefinition.name}_${arrayField.name}.value as ${arrayField.name}`)
                .leftOuterJoin(
                    `${typeDefinition.name}_${arrayField.name}`,
                    `${typeDefinition.name}.id`,
                    `${typeDefinition.name}_${arrayField.name}.${typeDefinition.name}`
                );
        }

        const queryWithExpands = expandedQuery({
            query: baseQuery,
            requestedType: typeDefinition,
            expands
        });

        const queryWithFilter = filteredQuery({
            query: queryWithExpands,
            requestedType: typeDefinition,
            filters
        });

        const results = await await queryWithFilter;
        const transformedResults = _.map(
            results,
            (result) => _.reduce(
                queryWithExpands.transformFunctions,
                (acc, func) => func(acc),
                result
            )
        );

        const keys = _.map(arrayFields, (field) => field.name);
        const groupedResults = _.groupBy(transformedResults, 'id');

        const fullResults = _.mapValues(
            groupedResults,
            (group) => {
                const preparedArrays = _.reduce(keys, (acc, el) => ({ ...acc, [el]: [] }), {});
                return _.reduce(
                    group,
                    (acc, el) => {
                        _.forEach(keys, (key) => {
                            if (!_.isNil(el[key])) {
                                acc[key].push(el[key]);
                            }
                        });
                        return acc;
                    },
                    { ..._.head(group), ...preparedArrays }
                );
            }
        );

        return _.values(fullResults);
    }

    _hasProperty(typeDefinition, property) {
        return _.findIndex(typeDefinition.properties, { name: property }) >= 0;
    }

    async get({ typeDefinition, id, expands = [] }) {
        return await this.list({
            typeDefinition,
            filters: [`id=${id}`],
            expands
        });
    }

    async insert(typeDefinition, data) {
        const databaseData = this._removeUnneededDataAttributes(typeDefinition, data);

        const withoutArraysData = this._removeArrayDataAttributes(typeDefinition, databaseData);
        const arraysData = this._removeNonArrayDataAttributes(typeDefinition, databaseData);

        const result = await this.k(typeDefinition.name).insert(withoutArraysData).returning('id');
        const id = result[0];

        const arrayKeys = _.keys(arraysData);
        for (const arrayKey of arrayKeys) {
            await this._insertArrayData({
                typeDefinition,
                arrayKey,
                arrayData: arraysData[arrayKey],
                id
            });
        }

        return result;
    }

    async delete(typeDefinition, id) {
        return await this.k(typeDefinition.name).where('id', id).del();
    }

    async update(typeDefinition, id, data) {
        const databaseData = this._removeUnneededDataAttributes(typeDefinition, data);

        const withoutArraysData = this._removeArrayDataAttributes(typeDefinition, databaseData);
        const arraysData = this._removeNonArrayDataAttributes(typeDefinition, databaseData);

        await this.k(typeDefinition.name).update(withoutArraysData).where('id', id);

        const arrayKeys = _.keys(arraysData);
        for (const arrayKey of arrayKeys) {
            await this.k(`${typeDefinition.name}_${arrayKey}`).where(typeDefinition.name, id).del();

            await this._insertArrayData({
                typeDefinition,
                arrayKey,
                arrayData: arraysData[arrayKey],
                id
            });
        }

        return [id];
    }

    _removeUnneededDataAttributes(typeDefinition, data) {
        const properties = _.map(typeDefinition.properties, (property) => property.name);
        return _.pick(data, properties);
    }

    _removeArrayDataAttributes(typeDefinition, data) {
        const properties = _(typeDefinition.properties)
            .filter((property) => !_.isArray(property.type))
            .map((property) => property.name)
            .value();

        return _.pick(data, properties);
    }

    _removeNonArrayDataAttributes(typeDefinition, data) {
        const properties = _(typeDefinition.properties)
            .filter((property) => _.isArray(property.type))
            .map((property) => property.name)
            .value();

        return _.pick(data, properties);
    }

    async _insertArrayData({ typeDefinition, arrayKey, arrayData, id }) {
        const mappedArrayData = _.map(arrayData, (data) => ({
            [typeDefinition.name]: id,
            value: data
        }));

        if (mappedArrayData.length > 0) {
            await this.k(`${typeDefinition.name}_${arrayKey}`).insert(mappedArrayData);
        }
    }

    _collectDependencies(typeDefinition) {
        const dependencies = [];
        for (const property of typeDefinition.properties) {
            if (!typeMapping[property.type] && !dependencies.includes(property.type)) {
                dependencies.push(property.type);
            }
        }
        return dependencies;
    }

    async _createTableForType(typeDefinition) {
        if (!await this.k.schema.hasTable(typeDefinition.name)) {
            const arrayTables = [];

            await this.k.schema.createTable(typeDefinition.name, (t) => {
                t.increments();
                for (const property of typeDefinition.properties) {
                    if (isNativeType(property.type)) {
                        const databaseType = typeMapping[property.type];
                        t[databaseType](property.name);
                    } else if (_.isArray(property.type)) {
                        arrayTables.push({
                            tableName: `${typeDefinition.name}_${property.name}`,
                            type: property.type[0],
                            parent: typeDefinition.name
                        });
                    } else {
                        t
                            .integer(property.name)
                            .references('id')
                            .inTable(property.type.name)
                            .onDelete('CASCADE')
                            .onUpdate('CASCADE');
                    }
                }
            });

            this._createArrayTables(arrayTables);
        }
    }

    async _createArrayTables(arrayTables) {
        for (const arrayTable of arrayTables) {
            await this._createArrayTable(arrayTable);
        }
    }

    async _createArrayTable(arrayTable) {
        if (!await this.k.schema.hasTable(arrayTable.tableName)) {
            await this.k.schema.createTable(arrayTable.tableName, (t) => {
                t.increments();
                t
                    .integer(arrayTable.parent)
                    .references('id')
                    .inTable(arrayTable.parent)
                    .onDelete('CASCADE')
                    .onUpdate('CASCADE');

                if (isNativeType(arrayTable.type)) {
                    const databaseType = typeMapping[arrayTable.type];
                    t[databaseType]('value');
                } else {
                    t
                        .integer('value')
                        .references('id')
                        .inTable(arrayTable.type.name)
                        .onDelete('CASCADE')
                        .onUpdate('CASCADE');
                }
            });
        }
    }

};
