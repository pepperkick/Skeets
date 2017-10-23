import config from 'config';
import debug from 'debug';
import Discord from 'discord.js';

const log = debug('eve:discord');
const bot = new Discord.Client();

export default async () => {
    try {
        bot.on('ready', () => {
            log('Service is ready!');
        });

        bot.on('message', (message) => {
            if (message.author.id === bot.user.id) {
                return;
            }

            log(message);
        });

        await bot.login(config.get('bot.token'));
    } catch (error) {
        log(error);
    }
};