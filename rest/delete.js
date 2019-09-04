const _ = require('lodash');

module.exports = function(typeDefinition, databaseHandler) {
    return async function(request, response) {
        const id = parseInt(_.last(request.path.split('/')));
        await databaseHandler.delete(typeDefinition, id);
        response.sendStatus(200);
    }
};
