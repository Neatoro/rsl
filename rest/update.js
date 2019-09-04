const _ = require('lodash');
const updateOrCreate = require('./updateOrCreate');

module.exports = function(typeDefinition, databaseHandler) {
    return updateOrCreate(typeDefinition, async (typeDefinition, request) => {
        const id = parseInt(_.last(request.path.split('/')));
        return await databaseHandler.update(typeDefinition, id, request.body);
    });
}
