const _ = require('lodash');

function getExpand(query) {
    if (!_.isUndefined(query.expand)) {
        return query.expand.split(',');
    }
    return [];
}

module.exports = function(typeDefinition, app) {
    return async function(request, response) {
        const id = parseInt(_.last(request.path.split('/')));
        const expands = getExpand(request.query);

        const entry = await app.service(typeDefinition.name).get({ id: id, expands });
        if (!_.isUndefined(entry)) {
            response.status(200).json(entry);
        } else {
            response.sendStatus(404);
        }
    }
};
