import config from 'config';
import debug from 'debug';
import Discord from 'discord.js';

const log = debug('eve:service:discord');
const bot = new Discord.Client();

function filterMessage(message) {
    const text = message.content;

    return /eve/gi.test(text);
}

export default async (app) => {
    try {
        bot.on('ready', () => {
            log('Service is ready!');
        });

        bot.on('message', (message) => {
            if (message.author.id === bot.user.id || !filterMessage(message)) {
                return;
            }

            app.service('messages').handle(message);
        });

        await bot.login(config.get('service.discord.token'));
    } catch (error) {
        log(error);
    }
};