import discord from './discord';
import messages from './messages';
import dialogflow from './dialogflow';

const actionRegistry = {};

export default async (app) => {
    app.registerAction = (action, func) => actionRegistry[action] = func;
    app.callAction = (action, data) => {
        if (actionRegistry[action])
            actionRegistry[action](data);
        else
            throw new Error(`Unknown action ${action}`);
    };

    return {
        discord: await discord(app),
        messages: await messages(app),
        dialogflow: await dialogflow(app),
    };
};