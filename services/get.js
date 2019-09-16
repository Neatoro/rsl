const { toKebapCase } = require('../util');

module.exports = function createGet(typeDefinition, database) {
    return async function get({ id, expands = [] }) {
        const result = await database.get({ typeDefinition, id, expands });

        if (result.length > 0) {
            return result[0];
        }
    };
};
