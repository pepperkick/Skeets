import discord from './discord';

export default async (app) => {
    return {
        discord: await discord(app)
    };
};