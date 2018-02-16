import debug from 'debug';

const log = debug('skeets:service:discord:voice');

const connectionBank = {};

export default async (app, discord) => {
    const message = app.service('messages');
    const reply = app.service('reply');

    app.registerAction('discord', 'bot.join', (data) => botJoin(data));
    app.registerCommand('join', (data) => botJoin(data));

    const botJoin = async (data) => {
        const member = data.message.member;

        if (!data.message.guild) {
            return await message.sendErrorMessage(reply.getReply('common.error.onlyGuild'), data.message);
        }

        if (!member.voiceChannel) {
            return await message.sendErrorMessage(reply.getReply('voice.error.notInVoiceChannel'), data.message);
        }

        await joinChannel(member.voiceChannel);

        message.sendInfoMessage(reply.getReply('voice.info.connected'), data.message);
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
            channel = discord.channels.get(channel);
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

    log('Service Started!');

    return {
        joinChannel,
        getConnection: (guild) => connectionBank[guild].connection,
        getReceiver: (guild) => connectionBank[guild].receiver,
    };
};