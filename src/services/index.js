import discord from './discord';
import messages from './messages';
import natural from './natural';

export default async (app) => {
    return {
        discord: await discord(app),
        messages: await messages(app),
        natural: await natural(app),
    };
};