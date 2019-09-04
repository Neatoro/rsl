const _ = require('lodash');

function isDirectFilter(type, filter) {
    return filter.name === 'id' || _.findIndex(type.properties, { name: filter.name }) > -1;
}

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

function getDirectFilterDatabaseName(type, filter) {
    return `${type.name}.${filter.name}`;
}

module.exports = function filteredQuery({
    query,
    requestedType,
    filters
}) {

    const mappedFilters = _.map(filters, getFilterParameters);
    const directFilters = _(mappedFilters)
        .filter((filter) => isDirectFilter(requestedType, filter))
        .map((filter) => ({ ...filter, dbName: getDirectFilterDatabaseName(requestedType, filter)}))
        .value();

    const validFilters = [...directFilters];

    return _.reduce(
        validFilters,
        (actual, filter) => actual.where(
            filter.dbName,
            filter.operation,
            filter.value
        ),
        query
    );
}
