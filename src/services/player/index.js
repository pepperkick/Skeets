import fs from 'fs';
import debug from 'debug';
import config from 'config';
import moment from 'moment';
import url from 'valid-url';
import ytdl from 'ytdl-core';

const log = debug('skeets:service:player');

const players = {};
const channels = {};
const messages = {};
const playerMessages = {};
const cacheInfo = {};
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
    app.registerAction('player.info', (data) => filter('info', data));
    app.registerAction('player.repeat', (data) => filter('repeat', data));
    app.registerAction('music.query', (data) => filter('query', data));
    app.registerAction('music.url', (data) => filter('url', data));

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
        else if (action === 'url') playURL(data);
        else if (action === 'play') playCommand(guild);
        else if (action === 'pause') pauseCommand(guild);
        else if (action === 'stop') stopCommand(guild);
        else if (action === 'next') playNext(guild);
        else if (action === 'info') infoCommand(guild);
        else if (action === 'previous') playPrevious(guild);
        else if (action === 'repeat') repeatCommand(guild);
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

    const playURL = async (data) => {
        const message = data.message;
        const entities = data.response.result.parameters;
        const guildID = message.guild.id;

        if (!entities.url) {
            await app.service('messages').sendErrorMessage(app.service('reply').getReply('common.error.failure'), message);
        }

        log(entities.url);

        try {
            const urls = entities.url;

            const user = message.author.username;
            const text = app.service('reply').getReply('chat.acknowledge');
            const reply = app.service('reply').processReply.name(text, user);
            await app.service('messages').sendSuccessMessage(reply, message);

            for (const url of urls) {
                let parts = url.split('v=')[1];
                parts = parts != undefined ? parts : entities.url.split('youtu.be/')[1];

                const videoID = parts.split('&')[0];

                if (!videoID)
                    throw new Error('Video ID not extracted properly');

                await queue(guildID, videoID);
            }
        } catch (error) {
            log(error);

            await app.service('messages').sendErrorMessage(app.service('reply').getReply('common.error.failure'), message);

            throw new Error(error);
        }
    };

    const playCommand = async (guild) => {
        if (!players[guild]) {
            return await app.service('messages').sendInfoMessage(app.service('reply').getReply('player.error.noPlaylist'), getGuildChannel(guild));
        }

        const status = getPlayerStatus(guild);

        if (status === 'stopped') {
            await app.service('messages').sendInfoMessage(app.service('reply').getReply('player.error.noSong'), getGuildChannel(guild));
        } else if (status === 'playing') {
            await app.service('messages').sendInfoMessage(app.service('reply').getReply('player.error.alreadyPlaying'), getGuildChannel(guild));
        } else if (status === 'paused') {
            getPlayerDispatcher(guild).resume();
            setPlayerStatus(guild, 'playing');

            await app.service('messages').sendInfoMessage(app.service('reply').getReply('player.info.resume'), getGuildChannel(guild));
        }
    };

    const pauseCommand = async (guild) => {
        if (!players[guild]) {
            return await app.service('messages').sendInfoMessage(app.service('reply').getReply('player.error.noPlaylist'), getGuildChannel(guild));
        }

        const status = getPlayerStatus(guild);

        if (status === 'stopped') {
            await app.service('messages').sendInfoMessage(app.service('reply').getReply('player.error.noSong'), getGuildChannel(guild));
        } else if (status === 'paused') {
            await app.service('messages').sendInfoMessage(app.service('reply').getReply('player.error.alreadyPaused'), getGuildChannel(guild));
        } else if (status === 'playing') {
            getPlayerDispatcher(guild).pause();
            setPlayerStatus(guild, 'paused');

            await app.service('messages').sendInfoMessage(app.service('reply').getReply('player.info.paused'), getGuildChannel(guild));
        }
    };

    const stopCommand = async (guild) => {
        if (!players[guild]) {
            return await app.service('messages').sendInfoMessage(app.service('reply').getReply('player.error.noPlaylist'), getGuildChannel(guild));
        }

        log(`Current player status ${getPlayerStatus(guild)}`);

        getPlayerDispatcher(guild).end('stop');
        setPlayerStatus(guild, 'stopped');

        await app.service('messages').sendInfoMessage(app.service('reply').getReply('player.info.stopped'), getGuildChannel(guild));

        delete players[guild];
    };

    const infoCommand = async guild => {
        if (!players[guild]) {
            return await app.service('messages').sendInfoMessage(app.service('reply').getReply('player.error.noPlaylist'), getGuildChannel(guild));
        }

        const index = getPlayerIndex(guild);
        const song = getPlaylistIndex(guild, index);
        const youtubeInfo = await app.service('youtube').getInfo(song);
        const lastfmInfo = await app.service('lastfm').getInfo(youtubeInfo.title);

        const length = youtubeInfo.length_seconds;
        const played = getPlayerDispatcher(guild).time;

        const lengthTime = moment.utc(length * 1000).format('HH:mm:ss');
        const playedTime = moment.utc(played).format('HH:mm:ss');

        const message = {
            embed: {
                color: app.service('reply').replyColor.normal.cyan,
                title: `** ${youtubeInfo.title} ** `,
                description: `** ${playedTime} / ${lengthTime} ** `,
                url: youtubeInfo.video_url,
                author: {
                    name: youtubeInfo.author.name,
                    icon_url: youtubeInfo.author.avatar,
                    url: youtubeInfo.author.channel_url
                },
                timestamp: new Date(),
                image: {
                    url: youtubeInfo.iurlmaxres
                        || youtubeInfo.iurlhq
                        || youtubeInfo.iurlmq
                        || youtubeInfo.iurlsd
                },
                fields: [],
                footer: {
                    icon_url: config.get('bot.avatar'),
                    text: `${config.get('bot.name')} - Now Playing`
                }
            }
        };

        if (lastfmInfo) {
            message.embed.title = `${lastfmInfo.name} by ${lastfmInfo.artist}`;
            message.embed.url = lastfmInfo.url;

            if (lastfmInfo.image[2]['#text'] !== '') {
                message.embed.image = {
                    url: lastfmInfo.image[2]['#text']
                };
            }

            log(lastfmInfo.image);
        }

        if (getPlaylistIndex(guild, index - 1)) {
            const song = getPlaylistIndex(guild, index - 1);
            const info = await app.service('youtube').getInfo(song);

            message.embed.fields.push({
                name: 'Previously Played',
                value: `[${info.title}](${info.video_url}) ** by ** [${info.author.name}](${info.author.channel_url}) `
            });
        }

        if (getPlaylistIndex(guild, index + 1)) {
            const song = getPlaylistIndex(guild, index + 1);
            const info = await app.service('youtube').getInfo(song);

            message.embed.fields.push({
                name: 'Up Next',
                value: `[${info.title}](${info.video_url})** by ** [${info.author.name}](${info.author.channel_url}) `
            });
        }

        playerMessages[guild] = await app.service('messages').sendMessage('', getGuildChannel(guild), message);
        cacheInfo[song] = youtubeInfo;
    };

    const playlistCommand = async (guild) => {

    };

    const queue = async (guild, id) => {
        const info = await app.service('youtube').getInfo(id);
        const text = `Added ** [${info.title}](${info.video_url}) ** by ** [${info.author.name}](${info.author.channel_url}) ** to the playlist`;
        await app.service('messages').sendInfoMessage(text, getGuildChannel(guild));

        if (players[guild]) {
            const status = getPlayerStatus(guild);

            await addToPlaylist(guild, id);

            if (status === 'stopped') {
                playNext(guild);
            } else {
                app.service('file').cache(id);
            }
        } else {
            await createPlayer(guild);
            await addToPlaylist(guild, id);
            await playNext(guild, id);
        }
    };

    const playNext = async (guild) => {
        if (!players[guild]) {
            return await app.service('messages').sendInfoMessage(app.service('reply').getReply('player.error.noPlaylist'), getGuildChannel(guild));
        }

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
        if (!players[guild]) {
            return await app.service('messages').sendInfoMessage(app.service('reply').getReply('player.error.noPlaylist'), getGuildChannel(guild));
        }

        const index = getPlayerIndex(guild) - 1;
        const song = getPlaylistIndex(guild, index);

        if (song) {
            play(guild, song);
            setPlayerIndex(guild, index);
        } else {
            await app.service('messages').sendInfoMessage(app.service('reply').getReply('player.info.playlistFirst'), getGuildChannel(guild));
        }
    };

    const play = async (guild, id, options = {}) => {
        if (getPlayerStatus(guild) === 'playing')
            getPlayerDispatcher(guild).end('next');

        setPlayerStatus(guild, 'queued');

        const url = `https://www.youtube.com/watch?v=${id}`;
        const file = app.service('file').getFile(id);

        let dispatcher;

        if (file) {
            dispatcher = await getPlayerConnection(guild).playFile(file.path, streamOptions);
        } else {
            dispatcher = await getPlayerConnection(guild).playStream(ytdl(url), streamOptions);
        }

        log(`Playing ${id} !`);
        setPlayerStatus(guild, 'playing');
        setPlayerDispatcher(guild, dispatcher);

        dispatcher.on('end', (reason) => {
            log(`Stream stopped due to ${reason}`);

            if (reason === 'next' || reason === 'stop') return;

            if (!reason) return play(guild, id, { noinfo: true });

            setPlayerStatus(guild, 'stopped');

            playNext(guild);
        });

        if (!options.noinfo)
            infoCommand(guild);
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

    const repeatCommand = async (guild) => {

    };

    const getSongInfo = async (id) => {
        const youtubeInfo = await app.service('youtube').getInfo(id);
        const lastfmInfo = await app.service('lastfm').getInfo(youtubeInfo.title);


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