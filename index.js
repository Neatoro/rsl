const _ = require('lodash');
const create = require('./rest/create');
const DatabaseHandler = require('./database/handler');
const fs = require('fs');
const get = require('./rest/get');
const http = require('http');
const list = require('./rest/list');
const mime = require('./mime');
const pathUtil = require('path');
const { parse } = require('./compiler/parser');
const restDelete = require('./rest/delete');
const RSLRequest = require('./server/RSLRequest');
const RSLResponse = require('./server/RSLResponse');
const { toKebapCase } = require('./util');
const { tokenize } = require('./compiler/tokenizer');
const update = require('./rest/update');

const fileTypeMatcher = /\.([a-zA-Z]+)$/m;

module.exports = class RSL {
    constructor({ client, connection }) {
        this._routes = [];
        this.database = new DatabaseHandler({ client, connection });
    }

    define(definition) {
        const tokens = tokenize(definition);
        const { typeDefinitions, route } = parse(tokens);
        this.database.createTablesForTypes(typeDefinitions);
        for (const typeDefinition of typeDefinitions) {
            this._defineRoutes(typeDefinition, route);
        }
    }

    _defineRoutes(typeDefinition, route) {
        const serviceName = toKebapCase(typeDefinition.name);
        const rootMatcher = new RegExp(`^${route}/${serviceName}[\/]?$`, 'm');
        const idMatcher = new RegExp(`^${route}/${serviceName}/[0-9]+[\/]?$`, 'm');
        const serviceRoutes = [
            {
                matcher: rootMatcher,
                method: 'GET',
                handler: list(typeDefinition, this.database)
            },
            {
                matcher: rootMatcher,
                method: 'POST',
                handler: create(typeDefinition, this.database)
            },
            {
                matcher: idMatcher,
                method: 'GET',
                handler: get(typeDefinition, this.database)
            },
            {
                matcher: idMatcher,
                method: 'DELETE',
                handler: restDelete(typeDefinition, this.database)
            },
            {
                matcher: idMatcher,
                method: 'PUT',
                handler: update(typeDefinition, this.database)
            }
        ];
        this._routes.push(...serviceRoutes);
    }

    static({ path, route }) {
        if (route === '/') {
            route = '';
        }

        this._routes.push({
            matcher: new RegExp(`^${route}[/]?.*$`, 'm'),
            method: 'GET',
            handler(request, response) {
                let contentPath = request.path.replace(route, '').replace(/\/$/m, '/index.html');
                if (contentPath === '') {
                    contentPath = '/index.html';
                }

                const fullPath = pathUtil.resolve(path, contentPath.substring(1));
                if (fs.existsSync(fullPath)) {
                    const typeMatch = fullPath.match(fileTypeMatcher);
                    if (_.isNil(typeMatch)) {
                        response.sendStatus(404);
                    }

                    const type = typeMatch[1];
                    fs.readFile(fullPath, (error, data) => {
                        response.send(data, mime[type]);
                    });
                } else {
                    response.sendStatus(404);
                }
            }
        })
    }

    async _requestHandler(request, response) {
        const route = _.find(this._routes, (route) => request.method === route.method && route.matcher.test(request.path));
        if (!_.isUndefined(route)) {
            if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
                request.body = await this._parseBody(request);
            }
            route.handler(request, response);
        } else {
            response.sendStatus(404);
        }
    }

    _parseBody(request) {
        return new Promise((resolve) => {
            const bodyData = [];
            request.on('data', (chunk) => {
                bodyData.push(chunk);
            }).on('end', () => {
                const body = Buffer.concat(bodyData).toString();
                if (request.headers['content-type'] === 'application/json') {
                    resolve(JSON.parse(body));
                } else {
                    resolve(body);
                }
            });
        })
    }

    listen(port, callback) {
        const server = http.createServer(
            { ServerResponse: RSLResponse, IncomingMessage: RSLRequest },
            this._requestHandler.bind(this)
        );
        server.listen(port, '0.0.0.0', callback);
        return server;
    }
};
