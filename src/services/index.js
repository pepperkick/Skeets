import debug from 'debug';

import discord from './discord';
import reply from './reply';
import file from './file';
import dialogflow from './dialogflow';
import lastfm from './lastfm';
import youtube from './youtube';
import cleverbot from './cleverbot';
import connection from './connection';
import sourcemod from './sourcemod';
import models from './models';

const log = debug('skeets:services');

const actionRegistry = {};
const commandRegistry = {};

export default async (app) => {
    app.registerAction = (service, action, func) => {
        if (!actionRegistry[service])
            actionRegistry[service] = {};

        actionRegistry[service][action] = func;
        log(`Action registered ${action} under service ${service}`);
    };

    app.callAction = (servicce, action, data) => {
        if (actionRegistry[servicce][action])
            actionRegistry[servicce][action](data);
        else
            throw new Error(`Unknown action ${action}`);
    };

    app.registerCommand = (commnad, func) => {
        commandRegistry[commnad] = func;
        log(`Command registered ${commnad}`);
    };

    app.callCommand = (commnad, data) => {
        if (commandRegistry[commnad])
            commandRegistry[commnad](data);
        else
            throw new Error(`Unknown command ${commnad}`);
    };

    const services = {
        discord: await discord(app),
        reply: await reply(app),
        file: await file(app),
        dialogflow: await dialogflow(app),
        youtube: await youtube(app),
        lastfm: await lastfm(app),
        cleverbot: await cleverbot(app),
        connection: await connection(app),
        sourcemod: await sourcemod(app),
        models
    };

    services.file.clean();

    return services;
};