const tokenizer = require('../compiler/tokenizer');

test('should return type token', () => {
    const tokens = tokenizer.tokenize('type');

    const firstResult = tokens.next();
    const secondResult = tokens.next();

    expect(firstResult.value).toEqual({ type: 'TYPE', value: 'type' });
    expect(secondResult.done).toEqual(true);
});

test('should return route token', () => {
    const tokens = tokenizer.tokenize('route');

    const result = tokens.next();

    expect(result.value).toEqual({ type: 'ROUTE', value: 'route' });
});

test('should return curly open token', () => {
    const tokens = tokenizer.tokenize('{');

    const result = tokens.next();

    expect(result.value).toEqual({ type: 'CURLY OPEN', value: '{' });
});

test('should return curly close token', () => {
    const tokens = tokenizer.tokenize('}');

    const result = tokens.next();

    expect(result.value).toEqual({ type: 'CURLY CLOSE', value: '}' });
});

test('should return color token', () => {
    const tokens = tokenizer.tokenize(':');

    const result = tokens.next();

    expect(result.value).toEqual({ type: 'COLON', value: ':' });
});

test('should return integer token', () => {
    const tokens = tokenizer.tokenize('Integer');

    const result = tokens.next();

    expect(result.value).toEqual({ type: 'INTEGER', value: 'Integer' });
});

test('should return string token', () => {
    const tokens = tokenizer.tokenize('String');

    const result = tokens.next();

    expect(result.value).toEqual({ type: 'STRING', value: 'String' });
});

test('should return boolean token', () => {
    const tokens = tokenizer.tokenize('Boolean');

    const result = tokens.next();

    expect(result.value).toEqual({ type: 'BOOLEAN', value: 'Boolean' });
});

test('should return float token', () => {
    const tokens = tokenizer.tokenize('Float');

    const result = tokens.next();

    expect(result.value).toEqual({ type: 'FLOAT', value: 'Float' });
});

test('should return date token', () => {
    const tokens = tokenizer.tokenize('Date');

    const result = tokens.next();

    expect(result.value).toEqual({ type: 'DATE', value: 'Date' });
});

test('should return route literal token', () => {
    const tokens = tokenizer.tokenize('/api/v1.0');

    const result = tokens.next();

    expect(result.value).toEqual({ type: 'ROUTE LITERAL', value: '/api/v1.0' });
});

test('should return id token', () => {
    const tokens = tokenizer.tokenize('Whatever');

    const result = tokens.next();

    expect(result.value).toEqual({ type: 'ID', value: 'Whatever' });
});

test('should return complex structure', () => {
    const tokens = tokenizer.tokenize(`
        route /api

        type Message {
            to: User
            from: User
            body: String
        }
    `);

    const expectedTokens = [
        { type: 'ROUTE', value: 'route' },
        { type: 'ROUTE LITERAL', value: '/api' },
        { type: 'TYPE', value: 'type' },
        { type: 'ID', value: 'Message' },
        { type: 'CURLY OPEN', value: '{' },
        { type: 'ID', value: 'to' },
        { type: 'COLON', value: ':' },
        { type: 'ID', value: 'User' },
        { type: 'ID', value: 'from' },
        { type: 'COLON', value: ':' },
        { type: 'ID', value: 'User' },
        { type: 'ID', value: 'body' },
        { type: 'COLON', value: ':' },
        { type: 'STRING', value: 'String' },
        { type: 'CURLY CLOSE', value: '}' }
    ];

    for (let i = 0; i < expectedTokens.length; i++) {
        const result = tokens.next();
        expect(result.value).toEqual(expectedTokens[i]);
    }

});
