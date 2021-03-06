const _ = require('lodash');
const { tokenTypes } = require('./tokenizer');

class UnexpectedTokenError extends Error {

    constructor(token) {
        super(`Unexpected Token ${token.value}`);
    }

}

class MissingTokenError extends Error {

    constructor(tokenType) {
        super(`Missing Token ${tokenType}`);
    }

}

class Type {

    constructor(name) {
        this.name = name;
        this.properties = [];
    }

};

class Property {

    constructor(name, type) {
        this.name = name;
        this.type = type;
        this.uniq = false;
        this.nullable = false;
    }

    setDecorators({ uniq, nullable }) {
        this.uniq = uniq;
        this.nullable = nullable;
    }

}

class Parser {
    constructor(tokens) {
        this.tokens = tokens;
        this.token = undefined;
    }

    _next() {
        const next = this.tokens.next();
        return next.done ? undefined : next.value;
    }

    _expect(...tokenTypes) {
        if (this.token === undefined) {
            throw new MissingTokenError(tokenTypes.join(' or '));
        }

        if (!tokenTypes.includes(this.token.type)) {
            throw new UnexpectedTokenError(this.token);
        }
    }

    parse() {
        const typeDefinitions = [];
        let route = '';
        while ((this.token = this._next()) !== undefined) {
            if (this.token.type === tokenTypes.type) {
                const type = this._parseType();
                typeDefinitions.push(type);
            } else if (this.token.type === tokenTypes.route) {
                route = this._parseRoute();
            } else {
                throw new UnexpectedTokenError(this.token);
            }
        }

        _.forEach(typeDefinitions, (typeDefinition) => {
            _.forEach(typeDefinition.properties, (property) => {
                if (_.isArray(property.type)) {
                    const fullType = _.find(typeDefinitions, (t) => t.name === property.type[0]);
                    if (!_.isUndefined(fullType)) {
                        property.type = [fullType];
                    }
                } else {
                    const fullType = _.find(typeDefinitions, (t) => t.name === property.type);
                    if (!_.isUndefined(fullType)) {
                        property.type = fullType;
                    }
                }
            });
        });

        return {
            typeDefinitions,
            route
        };
    }

    _parseType() {
        this._expect(tokenTypes.type);
        this.token = this._next();
        this._expect(tokenTypes.id);
        const type = new Type(this.token.value);
        this.token = this._next();
        this._parseBody(type);
        return type;
    }

    _parseBody(type) {
        this._expect(tokenTypes.curlyOpen);
        this.token = this._next();
        type.properties.push(...this._parseProperties());
        this._expect(tokenTypes.curlyClose);
    }

    _parseProperties() {
        const properties = [];
        while (this.token.type !== tokenTypes.curlyClose) {
            properties.push(this._parseProperty());
        }
        return properties;
    }

    _parseProperty() {
        const decorators = this._parseDecorators();

        this._expect(tokenTypes.id);
        const name = this.token.value;
        this.token = this._next();
        this._expect(tokenTypes.colon);
        this.token = this._next();

        const property = this.token.type !== tokenTypes.squareOpen ? this._parseSingleType(name) : this._parseArrayType(name);
        property.setDecorators(decorators);

        return property;
    }

    _parseDecorators() {
        const decorators = {
            uniq: false,
            nullable: false
        };

        while (_.includes([tokenTypes.uniq, tokenTypes.nullable], this.token.type)) {
            switch (this.token.type) {
                case tokenTypes.uniq:
                    decorators.uniq = true;
                    break;
                case tokenTypes.nullable:
                    decorators.nullable = true;
            }
            this.token = this._next();
        }

        return decorators;
    }

    _parseSingleType(name) {
        this._expect(
            tokenTypes.float,
            tokenTypes.integer,
            tokenTypes.string,
            tokenTypes.boolean,
            tokenTypes.id,
            tokenTypes.text,
            tokenTypes.date
        );

        const property = new Property(name, this.token.value);
        this.token = this._next();

        return property;
    }

    _parseArrayType(name) {
        this._expect(tokenTypes.squareOpen);
        this.token = this._next();

        this._expect(
            tokenTypes.float,
            tokenTypes.integer,
            tokenTypes.string,
            tokenTypes.boolean,
            tokenTypes.id,
            tokenTypes.date
        );

        const property = new Property(name, [this.token.value]);
        this.token = this._next();

        this._expect(tokenTypes.squareClose);
        this.token = this._next();

        return property;
    }

    _parseRoute() {
        this._expect(tokenTypes.route);
        this.token = this._next();
        this._expect(tokenTypes.routeLiteral);
        return this.token.value;
    }
}

module.exports = {
    parse(tokens) {
        const parser = new Parser(tokens);
        return parser.parse();
    }
}
