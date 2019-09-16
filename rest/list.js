const _ = require('lodash');

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

module.exports = function(typeDefinition, app) {
    return async function(request, response) {
        const filters = getFilters(request.query);
        const expands = getExpand(request.query);

        const result = await app.service(typeDefinition.name).list({
            typeDefinition,
            filters,
            expands,
            limit: request.query.limit,
            offset: request.query.offset
        });

        response.json(result);
    };
};
