import discord from './discord';

export default (app) => {
    const modules = [];

    modules.push(discord(app));
};