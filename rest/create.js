const updateOrCreate = require('./updateOrCreate');

module.exports = function(typeDefinition, databaseHandler) {
    return updateOrCreate(
        typeDefinition,
        async (typeDefinition, request) => await databaseHandler.insert(typeDefinition, request.body)
    );
}
