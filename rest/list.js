const _ = require('lodash');
const { toKebapCase } = require('../util');

function getFilters(query) {
    if (!_.isUndefined(query.filter)) {
        return decodeURI(query.filter).split(',');
    }
    return [];
}

function getExpand(query) {
    if (!_.isUndefined(query.expand)) {
        return query.expand.split(',');
    }
    return [];
}

module.exports = function(typeDefinition, databaseHandler) {
    return async function(request, response) {
        const filters = getFilters(request.query);
        const expands = getExpand(request.query);

        const result = await databaseHandler.list({
            typeDefinition,
            filters,
            expands,
            limit: request.query.limit,
            offset: request.query.offset
        });

        response.json({
            done: result.length === 0,
            [toKebapCase(typeDefinition.name)]: result
        });
    };
};
