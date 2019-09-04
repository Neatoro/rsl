const create = require('./rest/create');
const DatabaseHandler = require('./database/handler');
const express = require('express');
const get = require('./rest/get');
const list = require('./rest/list');
const { parse } = require('./compiler/parser');
const restDelete = require('./rest/delete');
const { toKebapCase } = require('./util');
const { tokenize } = require('./compiler/tokenizer');
const update = require('./rest/update');

module.exports = class RSL {
    constructor({ client, connection }) {
        this._app = express();
        this._app.use(express.json());
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
        const router = new express.Router();

        router.get(`/${serviceName}`, list(typeDefinition, this.database));
        router.post(`/${serviceName}`, create(typeDefinition, this.database));
        router.get(`/${serviceName}/:id`, get(typeDefinition, this.database));
        router.delete(`/${serviceName}/:id`, restDelete(typeDefinition, this.database));
        router.put(`/${serviceName}/:id`, update(typeDefinition, this.database));

        this._app.use(route, router);
    }

    static({ path, route }) {
       this._app.use(route, express.static(path));
    }

    listen(port, callback) {
        const server = this._app.listen(port, '0.0.0.0', callback);
        return server;
    }
};
