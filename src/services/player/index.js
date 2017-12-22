import fs from 'fs';
import debug from 'debug';
import url from 'valid-url';

const log = debug('eve:service:player');

const players = {};
const channels = {};
const messages = {};
const streamOptions = { seek: 0, volume: 0.5, passes: 3 };

export default async (app) => {
    app.registerCommand('play', {
        guildOnly: true,
    }, (data) => playCommand(data));

    app.registerAction('player.play', (data) => filter('play', data));
    app.registerAction('player.forward', (data) => filter('next', data));
    app.registerAction('player.backward', (data) => filter('previous', data));
    app.registerAction('player.pause', (data) => filter('pause', data));
    app.registerAction('player.resume', (data) => filter('play', data));
    app.registerAction('player.stop', (data) => filter('stop', data));
    app.registerAction('music.query', (data) => filter('query', data));

    const filter = async (action, data) => {
        const message = data.message;
        const guild = message.guild.id;

        if (!message.guild) {
            return await app.service('messages').sendErrorMessage(app.service('reply').getReply('common.error.onlyGuild'), message);
        }

        if (!message.member.voiceChannelID) {
            return await app.service('messages').sendErrorMessage(app.service('reply').getReply('voice.error.notInVoiceChannel'), message);
        }

        if (players[guild] && getPlayerConnection(guild) && message.member.voiceChannelID !== getPlayerConnection(guild).channel.id) {
            return await app.service('messages').sendErrorMessage(app.service('reply').getReply('voice.error.notInSameVoiceChannel'), message);
        }

        channels[message.guild.id] = message.channel.id;
        messages[message.guild.id] = message;

        if (action === 'query') searchQuery(data);
        else if (action === 'play') playCommand(guild);
        else if (action === 'pause') pauseCommand(guild);
        else if (action === 'stop') stopCommand(guild);
        else if (action === 'next') playNext(guild);
        else if (action === 'previous') playPrevious(guild);
    };

    const searchQuery = async (data) => {
        const message = data.message;
        const entities = data.response.result.parameters;
        const guildID = message.guild.id;

        if (!entities.search_query) {
            await app.service('messages').sendErrorMessage(app.service('reply').getReply('common.error.failure'), message);
        }

        log(`Searching for '${entities.search_query}'`);

        try {
            const result = await app.service('youtube').search(entities.search_query);

            if (result.items.length < 0) {
                await app.service('messages').sendErrorMessage(app.service('reply').getReply('player.error.noResult'), message);
            }

            log(`Found ${result.items.length} results for ${entities.search_query}`);

            const video = result.items[0];
            const videoID = video.id.videoId;

            const user = message.author.username;
            const text = app.service('reply').getReply('chat.acknowledge');
            const reply = app.service('reply').processReply.name(text, user);
            await app.service('messages').sendSuccessMessage(reply, message);

            await queue(guildID, videoID);
        } catch (error) {
            log(error);

            await app.service('messages').sendErrorMessage(app.service('reply').getReply('common.error.failure'), message);

            throw new Error(error);
        }
    };

    const playCommand = async (guild) => {
        const status = getPlayerStatus(guild);

        if (status === 'stopped') {
            //TODO: Send not playing message
        } else if (status === 'playing') {
            //TODO: Send playing message
        } else if (status === 'paused') {
            getPlayerDispatcher(guild).resume();
            setPlayerStatus(guild, 'playing');

            //TODO: Send playing message
        }
    };

    const pauseCommand = async (guild) => {
        const status = getPlayerStatus(guild);

        if (status === 'stopped') {
            //TODO: Send not playing message
        } else if (status === 'paused') {
            //TODO: Send paused message
        } else if (status === 'playing') {
            getPlayerDispatcher(guild).pause();
            setPlayerStatus(guild, 'paused');

            //TODO: Send paused message
        }
    };

    const stopCommand = async (guild) => {
        if (getPlayerStatus(guild) === 'playing') {
            getPlayerDispatcher(guild).end('stop');
        }

        delete players[guild];
    };

    const queue = async (guild, id) => {
        if (players[guild]) {
            const status = getPlayerStatus(guild);
            const info = await app.service('youtube').getInfo(id);
            const text = `Added **[${info.title}](${info.video_url})** by **[${info.author.name}](${info.author.channel_url})** to the playlist`;

            log(info);

            await addToPlaylist(guild, id);

            await app.service('messages').sendInfoMessage(text, getGuildChannel(guild));

            if (status === 'stopped') {
                await playNext(guild);
            }
        } else {
            await createPlayer(guild);
            await addToPlaylist(guild, id);
            await playNext(guild, id);
        }
    };

    const playNext = async (guild) => {
        const index = getPlayerIndex(guild) + 1;
        const song = getPlaylistIndex(guild, index);

        if (song) {
            play(guild, song);
            setPlayerIndex(guild, index);
        } else {
            await app.service('messages').sendInfoMessage(app.service('reply').getReply('player.info.playlistLast'), getGuildChannel(guild));
        }
    };

    const playPrevious = async (guild) => {
        const index = getPlayerIndex(guild) - 1;
        const song = getPlaylistIndex(guild, index);

        if (song) {
            play(guild, song);
            setPlayerIndex(guild, index);
        } else {
            await app.service('messages').sendInfoMessage(app.service('reply').getReply('player.info.playlistFirst'), getGuildChannel(guild));
        }
    };

    const play = async (guild, id) => {
        if (getPlayerStatus(guild) === 'playing') {
            getPlayerDispatcher(guild).end('next');
        }

        const file = await cacheStream(guild, id);
        const dispatcher = await getPlayerConnection(guild).playFile(file.path, streamOptions);
        const info = await app.service('youtube').getInfo(id);
        const text = `Now Playing **[${info.title}](${info.video_url})** by **[${info.author.name}](${info.author.channel_url})**`;

        log(`Playing ${id}!`);
        await app.service('messages').sendInfoMessage(text, getGuildChannel(guild));

        setPlayerStatus(guild, 'playing');
        setPlayerDispatcher(guild, dispatcher);

        dispatcher.on('end', (reason) => {
            log(reason);

            setPlayerStatus(guild, 'stopped');

            if (reason === 'next' || reason === 'stop') return;

            playNext(guild);
        });
    };

    const cacheStream = async (guild, id) => {
        const youtube = app.service('youtube');

        return new Promise(async (resolve, reject) => {
            try {
                const path = `./cache/${guild}.cache`;
                const stream = await youtube.getStream(id);
                const writeStream = fs.createWriteStream(path, streamOptions);

                stream.pipe(writeStream);

                stream.on('progress', (len, done, total) => {
                    log(`${done} / ${total}`);
                });

                stream.on('end', () => {
                    log('Cache Finished!');
                    resolve(writeStream);
                });
            } catch (error) {
                reject(error);
            }
        });
    };

    const createPlayer = async (guild) => {
        const voice = app.service('discordVoice');
        const player = {};
        const message = getGuildMessage(guild);

        let voiceConnection = await voice.getConnection(guild);

        if (!voiceConnection) {
            log('Bot is not connected to any voice channel');

            if (message.member.voiceChannelID) {
                voiceConnection = await app.service('discordVoice').joinChannel(message.member.voiceChannel);
                await app.service('messages').sendInfoMessage(app.service('reply').getReply('voice.info.connected'), getGuildChannel(guild));
            } else {
                await app.service('messages').sendErrorMessage(app.service('reply').getReply('voice.error.notInVoiceChannel'), getGuildChannel(guild));
            }
        } else if (voiceConnection && message.member.voiceChannelID !== voiceConnection.channel.id) {
            log('Bot is not in same voice channel');

            if (message.member.voiceChannelID) {
                voiceConnection = await app.service('discordVoice').joinChannel(message.member.voiceChannel);
                await app.service('messages').sendInfoMessage(app.service('reply').getReply('voice.info.connected'), getGuildChannel(guild));
            } else {
                await app.service('messages').sendErrorMessage(app.service('reply').getReply('voice.error.notInSameVoiceChannel'), getGuildChannel(guild));
            }
        }

        player.playlist = [];
        player.status = 'stopped';
        player.index = -1;
        player.connection = voiceConnection;

        players[guild] = player;
    };

    const getGuildChannel = (guild) => channels[guild];
    const getGuildMessage = (guild) => messages[guild];

    const addToPlaylist = (guild, id) => players[guild].playlist.push(id);
    const getPlaylistIndex = (guild, index) => players[guild].playlist[index];

    const getPlayerStatus = (guild) => players[guild].status;
    const getPlayerIndex = (guild) => players[guild].index;
    const getPlayerConnection = (guild) => players[guild].connection;
    const getPlayerDispatcher = (guild) => players[guild].dispatcher;

    const setPlayerStatus = (guild, status) => players[guild].status = status;
    const setPlayerDispatcher = (guild, dispatcher) => players[guild].dispatcher = dispatcher;
    const setPlayerIndex = (guild, index) => players[guild].index = index;

    return {

    };
};