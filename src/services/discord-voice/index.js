import debug from 'debug';

const log = debug('eve:service:discord-voice');

const connectionBank = {};

const replies = {
    notInVoiceChannel: [
        'You are not in a voice channel!',
        'I cannot find you in any voice channel!',
        'Please join a voice channel first!',
    ]
};

function getErrorReply(tag) {
    const length = replies[tag].length;
    const random = Math.floor(Math.random() * length);

    log(`Reply: ${tag} ${length} ${random} ${replies[tag][random]}`);

    return replies[tag][random];
}

export default async (app) => {
    app.registerCommand('join', (data) => {
        const member = data.message.member;

        if (!member.voiceChannel) {
            app.service('messages').sendErrorMessage(getErrorReply('notInVoiceChannel'), data.message);
        }
    });

    app.registerAction('bot.join', (data) => {
        const member = data.message.member;

        if (!member.voiceChannel) {
            app.service('messages').sendErrorMessage(getErrorReply('notInVoiceChannel'), data.message);
        }
    });

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

    const joinChannel = async (id) => {
        log(`Connecting to channel ${id}`);

        const discord = app.service('discord');
        const channel = await discord.channels.get(id);

        if (channel.type !== 'voice') {
            throw new Error(`Channel ${id} is not a voice channel`);
        }

        try {
            const connection = await channel.join();

            pushToBank(channel.guild.id, connection);
            attachHandlers(connection);

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