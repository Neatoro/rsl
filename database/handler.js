const _ = require('lodash');
const expandedQuery = require('./expandedQuery');
const filteredQuery = require('./filteredQuery');
const knex = require('knex');

const typeMapping = {
    'String': 'string',
    'Integer': 'integer',
    'Float': 'float',
    'Boolean': 'boolean',
    'Date': 'date'
};

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
                if (!_.isString(property.type) && property.type.name !== this.name) {
                    await property.type.resolve(resolver);
                }
            }
            resolver(this);
            this._resolved = true;
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
                property.type = this.types[property.type];
            });

        for (const type of _.values(this.types)) {
            await type.resolve(this._createTableForType.bind(this));
        }
    }

    async list(typeDefinition, filters = [], expands = []) {
        typeDefinition = this.types[typeDefinition.name];
        const selectFields = [
            `${typeDefinition.name}.id`,
            ..._.map(typeDefinition.properties, (property) => `${typeDefinition.name}.${property.name}`)
        ];

        const query = expandedQuery({
            query: this.k(typeDefinition.name).select(selectFields),
            requestedType: typeDefinition,
            expands
        });

        const queryWithFilter = filteredQuery({
            query,
            requestedType: typeDefinition,
            filters
        });

        const results = await await queryWithFilter;
        const transformedResults = _.map(
            results,
            (result) => _.reduce(
                query.transformFunctions,
                (acc, func) => func(acc),
                result
            )
        );

        return transformedResults;
    }

    _hasProperty(typeDefinition, property) {
        return _.findIndex(typeDefinition.properties, { name: property }) >= 0;
    }

    async get(typeDefinition, id, expands = []) {
        return await this.list(typeDefinition, [`id=${id}`], expands);
    }

    async insert(typeDefinition, data) {
        const databaseData = this._removeUnneededDataAttributes(typeDefinition, data);
        return await this.k(typeDefinition.name).insert(databaseData).returning('id');
    }

    async delete(typeDefinition, id) {
        return await this.k(typeDefinition.name).where('id', id).del();
    }

    async update(typeDefinition, id, data) {
        const databaseData = this._removeUnneededDataAttributes(typeDefinition, data);
        await this.k(typeDefinition.name).update(databaseData).where('id', id);
        return [id];
    }

    _removeUnneededDataAttributes(typeDefinition, data) {
        const properties = _.map(typeDefinition.properties, (property) => property.name);
        return _.pick(data, properties);
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
            await this.k.schema.createTable(typeDefinition.name, (t) => {
                t.increments();
                for (const property of typeDefinition.properties) {
                    if (isNativeType(property.type)) {
                        const databaseType = typeMapping[property.type];
                        t[databaseType](property.name);
                    } else {
                        t
                            .integer(property.name)
                            .references('id')
                            .inTable(property.type.name)
                            .onDelete('CASCADE')
                            .onUpdate('CASCADE');
                    }
                }
            })
        }
    }

};
