import debug from 'debug';
import url from 'valid-url';

const log = debug('eve:service:player');

export default async (app) => {
    app.registerCommand('play', {
        guildOnly: true,
    }, (data) => playCommand(data));

    app.registerAction('player.play', (data) => filter('play', data));
    app.registerAction('player.pause', (data) => pauseCommand(data));
    app.registerAction('player.resume', (data) => resumeCommand(data));
    app.registerAction('player.stop', (data) => stopCommand(data));
    app.registerAction('music.query', (data) => filter('query', data));

    const filter = async (action, data) => {
        const message = data.message;

        if (!message.guild) {
            return await app.service('messages').sendErrorMessage(app.service('reply').getReply('common.error.onlyGuild'), message);
        }

        if (action === 'query') searchQuery(data);
    };

    const searchQuery = async (data) => {
        const message = data.message;
        const entities = data.response.result.parameters;

        if (entities.search_query) {
            log(`Searching for '${entities.search_query}'`);
        }
    };

    const playCommand = async (data) => {
        const message = data.message;

        if (!message.guild) {
            return await app.service('messages').sendErrorMessage(app.service('reply').getReply('common.error.onlyGuild'), message);
        }

        const guild = message.guild;

        let voiceConnection = await app.service('discordVoice').getConnection(guild.id);

        if (!voiceConnection) {
            log('Bot is not connected to any voice channel');

            if (message.author.voiceChannelID) {
                voiceConnection = await app.service('discord-voice').joinVoiceChannel(message.author.voiceChannelID);

                playCommand(data);
            }

            return;
        }
    };

    return {

    };
};