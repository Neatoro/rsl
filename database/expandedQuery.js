const _ = require('lodash');
const { isNativeType } = require('../util');

function getExpandProperties(requestedType, expands) {
    return _(expands)
        .map((expand) => _.find(requestedType.properties, { name: expand }))
        .filter((property) => !_.isUndefined(property) && !isNativeType(property.type))
        .value();
}

module.exports = function expandedQuery({
    query,
    requestedType,
    expands
}) {
    const expandProperties = getExpandProperties(requestedType, expands);

    query.transformFunctions = [];

    const expandedQuery = _.reduce(
        expandProperties,
        (actual, property) => {
            const expandTableName = `expand_${property.name}`;

            const propertyNames = [
                'id',
                ..._.map(property.type.properties, (p) => p.name)
            ];

            const selectFields = _.map(
                propertyNames,
                (name) => `${expandTableName}.${name} as ${property.name}_${name}`
            );

            actual.transformFunctions.push(function(result) {
                result[property.name] = {};
                for (const propertyName of propertyNames) {
                    const fullName = `${property.name}_${propertyName}`
                    result[property.name][propertyName] = result[fullName];
                    result = _.omit(result, fullName);
                }
                return result;
            });

            return actual.select(selectFields).join(
                `${property.type.name} as ${expandTableName}`,
                `${requestedType.name}.${property.name}`,
                `${expandTableName}.id`
            );
        },
        query
    );

    return expandedQuery;
};
