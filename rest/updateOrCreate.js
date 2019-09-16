const _ = require('lodash');

function isValidRequestBody(body, typeDefintion) {
    const errorMissingProperties = findMissingProperties(body, typeDefintion);
    return errorMissingProperties ? errorMissingProperties : validatePropertyTypes(body, typeDefintion);
}

function findMissingProperties(body, typeDefintion) {
    const missingProperties = [];
    for (const property of typeDefintion.properties) {
        if (_.isUndefined(body[property.name])) {
            missingProperties.push(property.name);
        }
    }

    if (missingProperties.length > 0) {
        return {
            error: `The properties ${missingProperties.join(', ')} are missing, but required!`
        };
    }
}

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

function validatePropertyTypes(body, typeDefintion) {
    const wrongPropertyTypes = [];
    for (const property of typeDefintion.properties) {
        if (_.isArray(property.type)) {
            if (!_.isArray(body[property.name])) {
                wrongPropertyTypes.push(`${property.name} (Array)`);
            }
        } else {
            const validator = typeValidators[property.type] || _.isInteger;
            if (!validator(body[property.name])) {
                wrongPropertyTypes.push(`${property.name} (${property.type})`);
            }
        }
    }

    if (wrongPropertyTypes.length > 0) {
        return {
            error: `The properties ${wrongPropertyTypes.join(', ')} are having the wrong types!`
        };
    }
}

module.exports = function(typeDefintion, databaseFunction) {
    return async function(request, response) {
        const validationResult = isValidRequestBody(request.body, typeDefintion);
        if (_.isUndefined(validationResult)) {
            const result = await databaseFunction(typeDefintion, request);
            response.status(201).json({ id: result[0] });
        } else {
            response.status(400).json(validationResult);
        }
    };
};
