import discord from './discord';
import messages from './messages';
import natural from './natural';
import dialogflow from './dialogflow';

const actionRegistry = {};

export default async (app) => {
    app.registerAction = (action, func) => actionRegistry[action] = func;
    app.callAction = (action, data) => actionRegistry[action](data);

    return {
        discord: await discord(app),
        messages: await messages(app),
        natural: await natural(app),
        dialogflow: await dialogflow(app),
    };
};