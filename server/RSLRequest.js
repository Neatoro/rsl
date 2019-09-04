const http = require('http');
const url = require('url');

module.exports = class RSLRequest extends http.IncomingMessage {

    constructor(socket) {
        super(socket);
    }

    get path() {
        const parsedURL = url.parse(this.url, true);
        return parsedURL.pathname;
    }

    get query() {
        const parsedURL = url.parse(this.url, true);
        return parsedURL.query;
    }

};
