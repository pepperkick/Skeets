import debug from 'debug';

import discord from './discord';

const log = debug('eve:services');

export default (app) => {
    const modules = [];

    discord(app);

    modules.push();

    log('Services:', modules);
};