import config from 'config';
import debug from 'debug';
import Discord from 'discord.js';

import Voice from './voice';
import Messages from './messages';
import Player from './player';

const log = debug('skeets:service:discord');
const bot = new Discord.Client();

export default async (app) => {
    let voiceService, messageService, playerService;

    const handleVoiceConnections = () => {
        setTimeout(async () => {
            log('Connecting to voice channels');

            const guilds = config.get('guilds');

            for (const id in guilds) {
                const channel = await bot.channels.get(guilds[id].voice);

                voiceService.joinChannel(channel);
            }
        }, 5 * 1000);
    };

    const attachHandlers = () => {
        bot.on('ready', async () => {
            log('Service Started!');

            // bot.user.setUsername(config.get('bot.name'));
            // bot.user.setAvatar(config.get('bot.avatar'));

            voiceService = await Voice(app, bot);
            messageService = await Messages(app, bot);
            playerService = await Player(app, voiceService, messageService);

            handleVoiceConnections();
        });

        bot.on('message', (message) => {
            if (message.author.id === bot.user.id) {
                return;
            }

            messageService.handle(message);
        });

        bot.on('messageReactionAdd', (reaction, user) => {
            if (user.id === bot.user.id) {
                return;
            }

            log(`Received reaction on ${reaction.message.id} from ${user.id}`);

            playerService.handleReaction(reaction, user);
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