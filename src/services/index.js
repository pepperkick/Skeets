import discord from './discord';
import discordVoice from './discord-voice';
import messages from './messages';
import dialogflow from './dialogflow';

const actionRegistry = {};
const commandRegistry = {};

export default async (app) => {
    app.registerAction = (action, func) => actionRegistry[action] = func;
    app.callAction = (action, data) => {
        if (actionRegistry[action])
            actionRegistry[action](data);
        else
            throw new Error(`Unknown action ${action}`);
    };

    app.registerCommand = (commnad, func) => commandRegistry[commnad] = func;
    app.callCommand = (commnad, data) => {
        if (commandRegistry[commnad])
            commandRegistry[commnad](data);
        else
            throw new Error(`Unknown command ${commnad}`);
    };

    return {
        discordVoice: await discordVoice(app),
        discord: await discord(app),
        messages: await messages(app),
        dialogflow: await dialogflow(app),
    };
};