const _ = require('lodash');

const typeMapping = {
    'String': 'string',
    'Integer': 'integer',
    'Float': 'float',
    'Boolean': 'boolean',
    'Text': 'text',
    'Date': 'date'
};

module.exports = {
    toKebapCase(string) {
        return string.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
    },

    typeMapping,

    isNativeType(typeName) {
        return _(typeMapping).keys().includes(typeName);
    }
};
