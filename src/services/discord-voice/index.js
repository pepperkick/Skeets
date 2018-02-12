import debug from 'debug';

const log = debug('skeets:service:discord-voice');

const connectionBank = {};

export default async (app) => {
    app.registerAction('discord', 'bot.join', (data) => botJoin(data));
    app.registerCommand('join', (data) => botJoin(data));

    const botJoin = async (data) => {
        const member = data.message.member;

        if (!data.message.guild) {
            return await app.service('messages').sendErrorMessage(app.service('reply').getReply('common.error.onlyGuild'), data.message);
        }

        if (!member.voiceChannel) {
            return await app.service('messages').sendErrorMessage(app.service('reply').getReply('voice.error.notInVoiceChannel'), data.message);
        }

        await joinChannel(member.voiceChannel);

        app.service('messages').sendInfoMessage(app.service('reply').getReply('voice.info.connected'), data.message);
    };

    const pushToBank = (guild, connection) => {
        const receiver = connection.createReceiver();

        connectionBank[guild] = {
            connection,
            receiver
        };
    };

    const attachHandlers = connection => {
        connection.on('disconnect', () => {
            log(`Disconnected from voice channel for guild ${connection.channel.guild.id}`);
        });
    };

    const joinChannel = async (channel) => {
        if (!channel) {
            throw new Error('Recieved empty channel');
        } else if (channel instanceof Object) {
            log(`Connecting to channel ${channel.id}`);

            if (channel.type !== 'voice') {
                throw new Error(`Channel ${channel.id} is not a voice channel`);
            }
        } else {
            channel = app.service('discord').channels.get(channel);
        }

        try {
            const connection = await channel.join();

            pushToBank(channel.guild.id, connection);
            attachHandlers(connection);

            log(`Connected to channel ${channel.id}`);

            return connection;
        } catch (error) {
            log(error);
            throw new Error('Voice connection Error!');
        }
    };

    try {
        return {
            joinChannel,
            getConnection: (guild) => connectionBank[guild].connection,
            getReceiver: (guild) => connectionBank[guild].receiver,
        };
    } catch (error) {
        log(error);
    }
};