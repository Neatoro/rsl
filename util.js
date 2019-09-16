const _ = require('lodash');

module.exports = {
    toKebapCase(string) {
        return string.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
    },

    typeMapping: {
        'String': 'string',
        'Integer': 'integer',
        'Float': 'float',
        'Boolean': 'boolean',
        'Text': 'text',
        'Date': 'date'
    },

    isNativeType(typeName) {
        return _(this.typeMapping).keys().includes(typeName);
    }
};
