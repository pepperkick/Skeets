import config from 'config';
import debug from 'debug';
import Discord from 'discord.js';

const log = debug('eve:discord');
const bot = new Discord.Client();

bot.on('ready', () => {
    log('Service is ready!');
});

export default (() => {
    log(config.get('bot.token'));
    bot.login(config.get('bot.token'));
});