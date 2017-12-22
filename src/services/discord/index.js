import config from 'config';
import debug from 'debug';
import Discord from 'discord.js';

const log = debug('eve:service:discord');
const bot = new Discord.Client();

function filterMessage(message) {
    const text = message.content;
    const alias = config.get('bot.alias');

    if (text.indexOf(config.get('bot.prefix')) === 0) {
        return true;
    }

    for (let i in alias) {
        const name = alias[i];
        const regex = new RegExp(`${name}`, 'gi');

        if (regex.test(text)) {
            return true;
        }
    }

    return false;
}

export default async (app) => {
    const handleVoiceConnections = () => {
        setTimeout(async () => {
            log('Connecting to voice channels');

            const voice = app.service('discordVoice');
            const guilds = config.get('guilds');

            for (const id in guilds) {
                const channel = await bot.channels.get(guilds[id].voice);

                voice.joinChannel(channel);
            }
        }, 5 * 1000);
    };

    const attachHandlers = () => {
        bot.on('ready', () => {
            log('Service is ready!');

            // bot.user.setUsername(config.get('bot.name'));
            // bot.user.setAvatar(config.get('bot.avatar'));

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