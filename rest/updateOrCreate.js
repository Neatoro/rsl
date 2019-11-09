const _ = require('lodash');
const { isNativeType } = require('../util');

const typeValidators = {
    'Integer': _.isInteger,
    'Float': _.isNumber,
    'String': _.isString,
    'Text': _.isString,
    'Boolean': _.isBoolean,
    'Date': isDate
};

const dateRegex = /[0-9]{4}-[01][0-9]-[0-3][0-9]/;
function isDate(value) {
    return dateRegex.test(value);
}

async function insert(databaseHandler, typeDefinition, data) {
    return await databaseHandler.insert(typeDefinition, data)
}

async function update(databaseHandler, typeDefinition, data, id) {
    return await databaseHandler.update(typeDefinition, id, data);
}

function validateRequest(typeDefinition, data) {
    const validationErrors = [];
    for (const property of typeDefinition.properties) {
        if (_.isNil(data[property.name]) && property.nullable) {
            continue;
        }

        if (_.isNil(data[property.name])) {
            validationErrors.push({
                error: 'MISSING_FIELD',
                field: property.name
            });
        } else if (isNativeType(property.type)) {
            validationErrors.push(...validateNativeType(property, data));
        } else if (!_.isArray(property.type)) {
            validationErrors.push(...validateCustomType(property, data));
        } else {
            validationErrors.push(...validateArray(property, data));
        }
    }
    return validationErrors;
}

function validateNativeType(property, data) {
    if (!typeValidators[property.type](data[property.name])) {
        return [{
            error: 'WRONG_TYPE',
            expectedType: property.type,
            field: property.name
        }];
    }
    return [];
}

function validateCustomType(property, data) {
    if (!_.isInteger(data[property.name]) && !_.isPlainObject(data[property.name])) {
        return [{
            error: 'WRONG_TYPE',
            expectedType: [property.type.name, 'Integer'],
            field: property.name
        }];
    }
    if (_.isPlainObject(data[property.name])) {
        return validateRequest(property.type, data[property.name]);
    }

    return [];
}

function validateArray(property, data) {
    const type = property.type[0];
    if (isNativeType(type)) {
        return _.flatMap(data[property.name], (datum, index) => {
            if (!typeValidators[type](datum)) {
                return [{
                    error: 'WRONG_TYPE',
                    expectedType: property.type,
                    field: `${property.name}[${index}]`
                }];
            }
            return [];
        });
    } else {
        return _.flatMap(data[property.name], (datum, index) => {
            if (!_.isInteger(datum) && !_.isPlainObject(datum)) {
                return [{
                    error: 'WRONG_TYPE',
                    expectedType: [type.name, 'Integer'],
                    field: `${property.name}[${index}]`
                }];
            }
            if (_.isPlainObject(datum)) {
                return validateRequest(type, datum);
            }
            return [];
        });
    }
}

async function handleData(databaseHandler, typeDefinition, data) {
    const id = data.id;

    for (const property of typeDefinition.properties) {
        if (!isNativeType(property.type) && _.isPlainObject(data[property.name])) {
            const result = await handleData(databaseHandler, property.type, data[property.name]);
            data[property.name] = result[0];
        } else if (_.isArray(property.type) && !isNativeType(property.type[0])) {
            for (let i = 0; i < data[property.name].length; i++) {
                if (_.isPlainObject(data[property.name][i])) {
                    const result = await handleData(databaseHandler, property.type[0], data[property.name][i]);
                    data[property.name][i] = result[0];
                }
            }
        }
    }

    if (_.isUndefined(id)) {
        return await insert(databaseHandler, typeDefinition, data);
    } else {
        return await update(databaseHandler, typeDefinition, data, id);
    }
}

module.exports = function(typeDefinition, databaseHandler) {
    return async function(request, response) {
        const validationResult = validateRequest(typeDefinition, request.body);
        if (validationResult.length === 0) {
            request.body.id = _.get(request, 'params.id');
            const result = await handleData(databaseHandler, typeDefinition, request.body);
            response.status(201).json({ id: result[0] });
        } else {
            response.status(400).json({ errors: validationResult });
        }
    };
};
