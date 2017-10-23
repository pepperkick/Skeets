import config from 'config';
import debug from 'debug';
import Discord from 'discord.js';

const log = debug('Eve');
const bot = new Discord.Client();

bot.login(config.get('bot.token'));

bot.on('ready', () => {
	log('Bot is ready!');
});