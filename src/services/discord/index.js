import config from 'config';
import debug from 'debug';
import Discord from 'discord.js';

const log = debug('skeets:service:discord');
const bot = new Discord.Client();

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
            if (message.author.id === bot.user.id) {
                return;
            }

            app.service('messages').handle(message);
        });

        bot.on('messageReactionAdd', (reaction, user) => {
            if (user.id === bot.user.id) {
                return;
            }

            log(`Received reaction on ${reaction.message.id} from ${user.id}`);

            app.service('player').handleReaction(reaction, user);
        });
    };

    const connectDiscord = async () => await bot.login(config.get('service.discord.token'));

    try {
        await attachHandlers();
        connectDiscord();

        return bot;
    } catch (error) {
        log(error);
        throw new Error('Discord connection error!');
    }
};