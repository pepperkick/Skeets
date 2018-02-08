import debug from 'debug';

import discord from './discord';
import discordVoice from './discord-voice';
import reply from './reply';
import file from './file';
import messages from './messages';
import dialogflow from './dialogflow';
import player from './player';
import lastfm from './lastfm';
import youtube from './youtube';

const log = debug('skeets:services');

const actionRegistry = {};
const commandRegistry = {};

export default async (app) => {
    app.registerAction = (action, func) => {
        actionRegistry[action] = func;
        log(`Action registered ${action}`);
    };

    app.callAction = (action, data) => {
        if (actionRegistry[action])
            actionRegistry[action](data);
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
        discordVoice: await discordVoice(app),
        discord: await discord(app),
        reply: await reply(app),
        file: await file(app),
        messages: await messages(app),
        dialogflow: await dialogflow(app),
        youtube: await youtube(app),
        lastfm: await lastfm(app),
        player: await player(app)
    };

    services.file.clean();

    return services;
};