import discord from './discord';
import messages from './messages';
import natural from './natural';
import dialogflow from './dialogflow';

export default async (app) => {
    return {
        discord: await discord(app),
        messages: await messages(app),
        natural: await natural(app),
        dialogflow: await dialogflow(app),
    };
};