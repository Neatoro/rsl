const _ = require('lodash');

function getExpand(query) {
    if (!_.isUndefined(query.expand)) {
        return query.expand.split(',');
    }
    return [];
}

module.exports = function(typeDefinition, databaseHandler) {
    return async function(request, response) {
        const id = parseInt(_.last(request.path.split('/')));
        const expand = getExpand(request.query);

        const entry = await databaseHandler.get(typeDefinition, id, expand);
        if (entry.length > 0) {
            response.status(200).json(entry[0]);
        } else {
            response.sendStatus(404);
        }
    }
};
