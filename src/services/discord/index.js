import config from 'config';
import debug from 'debug';
import Discord from 'discord.js';

const log = debug('eve:service:discord');
const bot = new Discord.Client();

function filterMessage(message) {
    const text = message.content;

    return /\beve\b/gi.test(text) || text.indexOf(config.get('bot.prefix')) === 0;
}

export default async (app) => {
    const handleVoiceConnections = () => {
        setTimeout(() => {
            log('Connecting to voice channels');

            const voice = app.service('discordVoice');
            const guilds = config.get('guilds');

            for(const id in guilds) {
                voice.joinChannel(guilds[id].voice);
            }
        }, 5 * 1000);
    };

    const attachHandlers = () => {
        bot.on('ready', () => {
            log('Service is ready!');

            handleVoiceConnections();
        });

        bot.on('message', (message) => {
            if (message.author.id === bot.user.id || !filterMessage(message)) {
                return;
            }

            app.service('messages').handle(message);
        });
    };

    const connectDiscord = async () => await bot.login(config.get('service.discord.token'));

    try {
        await attachHandlers();
        await connectDiscord();
        return bot;
    } catch (error) {
        log(error);
        throw new Error('Discord connection error!');
    }
};