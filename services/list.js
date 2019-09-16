const { toKebapCase } = require('../util');

module.exports = function createList(typeDefinition, database) {
    return async function list({ filters = [], expands = [], limit = 100, offset = 0}) {
        const result = await database.list({
            typeDefinition,
            filters,
            expands,
            limit,
            offset
        });

        return {
            done: result.length === 0,
            [toKebapCase(typeDefinition.name)]: result
        };
    };
};
