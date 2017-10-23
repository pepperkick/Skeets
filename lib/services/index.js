const discord = require('./discord');

export default (app => {
    const modules = [];

    modules.push(discord(app));
});