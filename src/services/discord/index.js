const config = require('config');
const debug = require('debug');
const Discord = require('discord.js');

const log = debug('eve:discord');
const bot = new Discord.Client();

bot.on('ready', () => {
    log('Service is ready!');
});

export default () => {
    bot.login(config.get('bot.token'));
};