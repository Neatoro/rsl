const _ = require('lodash');

const filterRegex = /^([^<>=]+)(<|>|=|<=|>=)([^<>=]+)$/m;
function getFilterParameters(filter) {
    if (filterRegex.test(filter)) {
        const match = filter.match(filterRegex);
        return {
            name: match[1],
            operation: match[2],
            value: match[3]
        };
    }
}

class ListQueryBuilder {

    constructor({ type, database }) {
        this.type = type;
        this.database = database;
        this._expands = [];
        this._filters = [];
        this._limit = 100;
        this._offset = 0;
        this._transformFunctions = [];
    }

    filter(filters) {
        filters = _.map(filters, (filter) => getFilterParameters(filter));
        this._filters = _.concat(this._filters, filters);
        return this;
    }

    expand(expands) {
        this._expands = _.concat(this._expands, expands);

        const transformFunctions = _.map(expands, this._createTransformFunction);
        this._transformFunctions = _.concat(this._transformFunctions, transformFunctions);

        return this;
    }

    _createTransformFunction(expand) {
        return (data) => _.map(data, (datum) => {
            datum[expand.name] = {};

            const fields = [
                'id',
                ..._.map(expand.type.properties, (p) => p.name)
            ];

            for (const field of fields) {
                const name = `${expand.name}_${field}`;
                datum[expand.name][field] = datum[name];
                datum = _.omit(datum, name);
            }

            return datum;
        });
    }

    limit(limit) {
        this._limit = limit;
        return this;
    }

    offset(offset) {
        this._offset = offset;
        return this;
    }

    get arrayFilters() {
        return _.filter(this._filters, this._isArrayFilter);
    }

    get directFilters() {
        return _.filter(this._filters, (filter) => !this._isArrayFilter(filter));
    }

    _isFilter(filter) {
        const property = _.find(
            this.type.properties,
            (property) => property.name === filter.name
        );

        return !_.isUndefined(property);
    }

    _isArrayFilter(filter) {
        const property = _.find(this.type.properties, (property) => property.name === filter.name);

        return !_.isUndefined(property) && _.isArray(property.type);
    }

    build() {
        const builderContext = this;
        const query = this.database
            .select(`${this.type.name}.id`, ..._.map(this.nonArrayFields, (field) => field.name))
            .from(function() {
                builderContext._buildBaseDataQuery.bind(builderContext)(this);
            });

        const queryWithArray = this._buildArrayQuery(query);
        const queryWithExpand = this._buildExpandQuery(queryWithArray);

        return queryWithExpand;
    }

    _buildBaseDataQuery(queryContext) {
        queryContext.select()
            .from(this.type.name)
            .as(this.type.name);

        for (let filter of this.directFilters) {
            queryContext.where(filter.name, filter.operation, filter.value);
        }

        queryContext.limit(this._limit)
            .offset(this._offset);
    }

    _buildArrayQuery(query) {
        for (const field of this.arrayFields) {
            query = query
                .select(`${this.type.name}_${field.name}.value as ${field.name}`)
                .join(
                    `${this.type.name}_${field.name}`,
                    `${this.type.name}_${field.name}.${this.type.name}`,
                    `${this.type.name}.id`
                );

        }

        return query;
    }

    get arrayFields() {
        return _.filter(this.type.properties, (property) => _.isArray(property.type));
    }

    get nonArrayFields() {
        return _.filter(this.type.properties, (property) => !_.isArray(property.type));
    }

    _buildExpandQuery(query) {
        const typeName = this.type.name;

        return _.reduce(
            this._expands,
            (acc, expand) => {
                const fields = [
                    'id',
                    ..._.map(expand.type.properties, (p) => p.name)
                ];

                for (const field of fields) {
                    acc = acc.select(`${expand.type.name}.${field} as ${expand.name}_${field}`);
                }

                acc.join(expand.type.name, `${typeName}.${expand.name}`, `${expand.type.name}.id`);

                return acc;
            },
            query
        );
    }

    transformData(data) {
        const arrayDataFields = _.map(this.arrayFields, (field) => field.name);

        const combinedArrayData = _(data)
            .groupBy('id')
            .values()
            .map((set) => {
                const entry = _.reduce(
                    set,
                    (acc, entry) => {
                        const baseObject = _.omit(entry, ...arrayDataFields);
                        for (const field of arrayDataFields) {
                            baseObject[field] = _.concat(acc[field] || [], entry[field]);
                        }
                        return { ...acc, ...baseObject };
                    },
                    {}
                );

                return entry;
            })
            .value();

        const expandedData = _.reduce(this._transformFunctions, (acc, transformFunction) => transformFunction(acc), combinedArrayData);

        return expandedData;
    }

}

module.exports = async function list({
    type,
    database,
    filters,
    expands,
    limit,
    offset
}) {
    const queryBuilder = new ListQueryBuilder({ type, database });

    const query = queryBuilder
        .filter(filters)
        .expand(expands)
        .limit(limit)
        .offset(offset)
        .build();

    const data = await query;

    return queryBuilder.transformData(data);
}
