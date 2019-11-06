const _ = require('lodash');
const DatabaseHandler = require('./database/handler');
const express = require('express');
const { parse } = require('./compiler/parser');
const restDelete = require('./rest/delete');
const restGet = require('./rest/get');
const restList = require('./rest/list');
const restUpdateOrCreate = require('./rest/updateOrCreate');
const serviceGet = require('./services/get');
const serviceList = require('./services/list');
const { toKebapCase } = require('./util');
const { tokenize } = require('./compiler/tokenizer');

module.exports = class RSL {
    constructor({ client, connection }) {
        this._app = express();
        this._app.use(express.json());
        this.database = new DatabaseHandler({ client, connection });
        this._services = {};
    }

    define(definition) {
        const tokens = tokenize(definition);
        const { typeDefinitions, route } = parse(tokens);
        this.database.createTablesForTypes(typeDefinitions);
        for (const typeDefinition of typeDefinitions) {
            this._defineService(typeDefinition);
            this._defineRoutes(typeDefinition, route);
        }
    }

    _defineService(typeDefinition) {
        this._services[typeDefinition.name] = {
            list: serviceList(typeDefinition, this.database),
            get: serviceGet(typeDefinition, this.database)
        };
    }

    service(name) {
        if (_.isUndefined(this._services[name])) {
            throw `Unknown service ${name}`;
        }
        return this._services[name];
    }

    _defineRoutes(typeDefinition, route) {
        const serviceName = toKebapCase(typeDefinition.name);
        const router = new express.Router();

        router.get(`/${serviceName}`, restList(typeDefinition, this));
        router.post(`/${serviceName}`, restUpdateOrCreate(typeDefinition, this.database));
        router.get(`/${serviceName}/:id`, restGet(typeDefinition, this));
        router.delete(`/${serviceName}/:id`, restDelete(typeDefinition, this.database));
        router.put(`/${serviceName}/:id`, restUpdateOrCreate(typeDefinition, this.database));

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
