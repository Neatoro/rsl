class UnknownTokenError extends Error {

    constructor(content) {
        super(`Unknown Token ${content}`);
    }

}

class Token {

    constructor(type, value) {
        this.type = type;
        this.value = value;
    }

}

const tokenTypes = {
    type: 'TYPE',
    route: 'ROUTE',
    routeLiteral: 'ROUTE LITERAL',
    id: 'ID',
    curlyOpen: 'CURLY OPEN',
    curlyClose: 'CURLY CLOSE',
    squareOpen: 'SQUARE OPEN',
    squareClose: 'SQUARE CLOSE',
    colon: 'COLON',
    string: 'STRING',
    integer: 'INTEGER',
    float: 'FLOAT',
    boolean: 'BOOLEAN',
    date: 'DATE'
};

const tokenMatchers = [
    {
        type: tokenTypes.type,
        regex: /type/,
        level: 0
    },
    {
        type: tokenTypes.route,
        regex: /route/,
        level: 0
    },
    {
        type: tokenTypes.routeLiteral,
        regex: /\/[\S]+/,
        level: 0
    },
    {
        type: tokenTypes.id,
        regex: /[a-zA-Z0-9_-]+/,
        level: -1
    },
    {
        type: tokenTypes.curlyOpen,
        regex: /{/,
        level: 0
    },
    {
        type: tokenTypes.curlyClose,
        regex: /}/,
        level: 0
    },
    {
        type: tokenTypes.squareOpen,
        regex: /\[/,
        level: 0
    },
    {
        type: tokenTypes.squareClose,
        regex: /\]/,
        level: 0
    },
    {
        type: tokenTypes.colon,
        regex: /:/,
        level: 0
    },
    {
        type: tokenTypes.string,
        regex: /String/,
        level: 0
    },
    {
        type: tokenTypes.integer,
        regex: /Integer/,
        level: 0
    },
    {
        type: tokenTypes.float,
        regex: /Float/,
        level: 0
    },
    {
        type: tokenTypes.boolean,
        regex: /Boolean/,
        level: 0
    },
    {
        type: tokenTypes.date,
        regex: /Date/,
        level: 0
    }
];

function compareMatcherResults(resultA, resultB) {
    return resultB.level - resultA.level;
}

module.exports = {
    tokenTypes,
    tokenize(content) {
        content = content.replace(/\s/g, ' ').replace(/\s{2,}/g, ' ').trim();

        return function* next() {
            while (content.length > 0) {
                content = content.trim();
                const results = tokenMatchers
                    .map((matcher) => {
                        const result = content.match(matcher.regex);
                        if (result !== null) {
                            return {
                                index: result.index,
                                type: matcher.type,
                                value: result[0],
                                level: matcher.level
                            };
                        }
                    })
                    .filter((result) => result !== undefined)
                    .filter((result) => result.index === 0)
                    .sort(compareMatcherResults);

                if (results.length > 0) {
                    const result = results[0];
                    content = content.substring(result.index + result.value.length);
                    yield new Token(result.type, result.value);
                } else {
                    throw new UnknownTokenError(content);
                }
            }
        }();
    }
};
