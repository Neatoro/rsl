const http = require('http');

module.exports = class RSLResponse extends http.ServerResponse {

    constructor(request) {
        super(request);
        this.statusCode = 200;
    }

    sendStatus(statusCode) {
        this.statusCode = statusCode;
        this.end(`${statusCode}`);
    }

    status(statusCode) {
        this.statusCode = statusCode;
        return this;
    }

    send(content, mime = 'text/html') {
        this.setHeader('Content-Type', mime);
        this.writeHeader(this.statusCode);
        this.end(content);
    }

    json(data) {
        this.setHeader('Content-Type', 'application/json');
        this.writeHeader(this.statusCode);
        this.end(JSON.stringify(data));
    }

};
