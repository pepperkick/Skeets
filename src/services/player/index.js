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
    app.registerAction('playlist.info', (data) => filter('playlist', data));
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
        else if (action === 'previous') playPrevious(guild);
        else if (action === 'info') infoCommand(guild);
        else if (action === 'playlist') playlistCommand(guild);
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
                if (checkIfPlaylist(url)) {
                    try {
                        const playlistID = url.substr(url.indexOf('list=') + 5);
                        const info = await app.service('youtube').playlistInfo(playlistID);
                        const items = info.items;
                        const text = `Adding songs from the playlist... (0 of ${items.length})`;
                        const embed = {
                            color: app.service('reply').replyColor.normal.orange,
                            description: text,
                            timestamp: new Date(),
                            footer: {
                                icon_url: config.get('bot.avatar'),
                                text: config.get('bot.name')
                            }
                        };
                        const reply = await app.service('messages').sendMessage('', message, {
                            embed
                        });

                        let count = 0;

                        for (const item of items) {
                            const videoID = item.snippet.resourceId.videoId;

                            await queue(guildID, videoID, { noAnnouce: true, noCache: true });

                            count++;

                            embed.description = `Adding songs from the playlist... (${count} of ${items.length})`;

                            reply.edit('', { embed });
                        }

                        embed.description = `Added ${count} songs!`;
                        embed.color = app.service('reply').replyColor.normal.green;

                        reply.edit('', { embed });
                    } catch (error) {
                        log(error);

                        let parts = url.split('v=')[1];
                        parts = parts != undefined ? parts : entities.url.split('youtu.be/')[1];

                        const videoID = parts.split('&')[0];

                        if (!videoID)
                            throw new Error('Video ID not extracted properly');

                        await queue(guildID, videoID);
                    }
                } else {
                    let parts = url.split('v=')[1];
                    parts = parts != undefined ? parts : entities.url.split('youtu.be/')[1];

                    const videoID = parts.split('&')[0];

                    if (!videoID)
                        throw new Error('Video ID not extracted properly');

                    await queue(guildID, videoID);
                }
            }
        } catch (error) {
            log(error);

            await app.service('messages').sendErrorMessage(app.service('reply').getReply('common.error.failure'), message);

            throw new Error(error);
        }
    };

    const playCommand = async (guild, options = {}) => {
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

            if (!options.noAnnouce)
                await app.service('messages').sendInfoMessage(app.service('reply').getReply('player.info.resume'), getGuildChannel(guild));
        }
    };

    const pauseCommand = async (guild, options = {}) => {
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

            if (!options.noAnnouce)
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
        delete playerMessages[guild];
    };

    const infoCommand = async (guild, options = {}) => {
        if (!players[guild]) {
            return await app.service('messages').sendInfoMessage(app.service('reply').getReply('player.error.noPlaylist'), getGuildChannel(guild));
        }

        const message = await infoMessage(guild, options);

        playerMessages[guild] = await app.service('messages').sendMessage('', getGuildChannel(guild), message);

        attachPlayer(guild);
    };

    const infoMessage = async (guild, options = {}) => {
        const index = getPlayerIndex(guild);
        const played = getPlayerDispatcher(guild).time;
        const song = getPlaylistIndex(guild, index);
        const songInfo = await getSongInfo(song);

        const lengthTime = moment.utc(songInfo.length * 1000).format('HH:mm:ss');
        const playedTime = moment.utc(played).format('HH:mm:ss');

        const message = {
            embed: {
                color: app.service('reply').replyColor.normal.cyan,
                title: `** ${songInfo.title} ** `,
                url: songInfo.url,
                author: {
                    name: songInfo.artist,
                    icon_url: songInfo.artistIcon,
                    url: songInfo.artistUrl
                },
                timestamp: new Date(),
                image: {
                    url: songInfo.image
                },
                fields: [],
                footer: {
                    icon_url: config.get('bot.avatar'),
                    text: `${config.get('bot.name')} - Now Playing`
                }
            }
        };

        if (!options.noTime) {
            message.embed.description = `** ${playedTime} / ${lengthTime} ** `;
        } else {
            message.embed.description = `** ${lengthTime} ** `;
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

        return message;
    };

    const attachPlayer = async guild => {
        const message = playerMessages[guild];
        const index = getPlayerIndex(guild);
        const length = getPlaylistLength(guild);

        if (index !== 0)
            await message.react('⏮');

        await message.react('⏯');
        await message.react('⏹');

        if (index !== length - 1)
            await message.react('⏭');

        if (length > 1)
            await message.react('ℹ');
    };

    const playlistCommand = async (guild) => {
        if (!players[guild]) {
            return await app.service('messages').sendInfoMessage(app.service('reply').getReply('player.error.noPlaylist'), getGuildChannel(guild));
        }

        const index = getPlayerIndex(guild);
        const maxItems = 5;
        const start = index < 2 ? 0 : index - 2;
        const end = start + maxItems;

        let songNames = '';

        for (let i = start; i < end; i++) {
            const song = getPlaylistIndex(guild, i);

            if (!song) continue;

            const songInfo = await getSongInfo(song);

            if (i === index) {
                songNames += `**${i + 1}: ${songInfo.title}**\n`;
            } else {
                songNames += `${i + 1}: ${songInfo.title}\n`;
            }
        }

        const embed = {
            color: app.service('reply').replyColor.normal.cyan,
            description: 'Playlist',
            timestamp: new Date(),
            fields: [
                {
                    name: 'Song Titile',
                    value: songNames
                }
            ],
            footer: {
                icon_url: config.get('bot.avatar'),
                text: `${config.get('bot.name')} - ${getPlaylistLength(guild)} Song(s) - Playlist`
            }
        };
        await app.service('messages').sendMessage('', getGuildChannel(guild), {
            embed
        });
    };

    const queue = async (guild, id, options = {}) => {
        if (!options.noAnnouce) {
            const info = await app.service('youtube').getInfo(id);
            const text = `Added ** [${info.title}](${info.video_url}) ** by ** [${info.author.name}](${info.author.channel_url}) ** to the playlist`;
            await app.service('messages').sendInfoMessage(text, getGuildChannel(guild));
        }

        if (players[guild]) {
            const status = getPlayerStatus(guild);

            await addToPlaylist(guild, id);

            if (status === 'stopped') {
                playNext(guild);
            } else if (!options.noCache) {
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

        let index;

        const status = getPlayerStatus(guild);

        if (status === 'playing' || status === 'paused') {
            index = getPlayerIndex(guild) - 1;
        } else {
            index = getPlayerIndex(guild);
        }

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
            infoCommand(guild, { noTime: true });
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

    const getSongInfo = async (song) => {
        if (cacheInfo[song])
            return cacheInfo[song];

        const youtubeInfo = await app.service('youtube').getInfo(song);
        const lastfmInfo = await app.service('lastfm').getInfo(youtubeInfo.title);

        const youtubePicURL = youtubeInfo.iurlmaxres
            || youtubeInfo.iurlhq
            || youtubeInfo.iurlmq
            || youtubeInfo.iurlsd;

        let songInfo = {};

        if (lastfmInfo) {
            songInfo = {
                title: lastfmInfo.name,
                artist: lastfmInfo.artist,
                url: lastfmInfo.url
            };

            if (lastfmInfo.image[2]['#text'] !== '') {
                songInfo.image = lastfmInfo.image[2]['#text'];
            } else {
                songInfo.image = youtubePicURL;
            }

            songInfo.lastfmInfo = lastfmInfo;
        } else {
            songInfo = {
                title: youtubeInfo.name,
                artist: youtubeInfo.author.name,
                url: youtubeInfo.video_url,
                image: youtubePicURL
            };
        }

        songInfo.youtubeInfo = youtubeInfo;
        songInfo.artistUrl = youtubeInfo.author.channel_url;
        songInfo.artistIcon = youtubeInfo.author.avatar;
        songInfo.length = youtubeInfo.length_seconds;

        cacheInfo[song] = songInfo;

        return songInfo;
    };

    setInterval(async () => {
        for (const guild in playerMessages) {
            if (getPlayerStatus(guild) !== 'playing') continue;

            const info = await infoMessage(guild);

            playerMessages[guild].edit('', info);
        }
    }, 10000);

    const checkIfPlaylist = async url => url.indexOf('list') > 0;

    const getGuildChannel = (guild) => channels[guild];
    const getGuildMessage = (guild) => messages[guild];

    const addToPlaylist = (guild, id) => players[guild].playlist.push(id);
    const getPlaylistIndex = (guild, index) => players[guild].playlist[index];
    const getPlaylistLength = (guild) => players[guild].playlist.length;

    const getPlayerStatus = (guild) => players[guild].status;
    const getPlayerIndex = (guild) => players[guild].index;
    const getPlayerConnection = (guild) => players[guild].connection;
    const getPlayerDispatcher = (guild) => players[guild].dispatcher;

    const setPlayerStatus = (guild, status) => players[guild].status = status;
    const setPlayerDispatcher = (guild, dispatcher) => players[guild].dispatcher = dispatcher;
    const setPlayerIndex = (guild, index) => players[guild].index = index;

    return {
        handleReaction: async (reaction, user) => {
            const message = reaction.message;
            const react = reaction.emoji;
            const guild = message.guild.id;

            if (playerMessages[guild].id !== message.id) return;

            if (!message.guild) {
                return await app.service('messages').sendErrorMessage(app.service('reply').getReply('common.error.onlyGuild'), message);
            }

            if (react.toString() === '⏮') {
                playPrevious(guild);
            } else if (react.toString() === '⏯') {
                if (getPlayerStatus(guild) === 'playing') {
                    pauseCommand(guild, { noAnnouce: true });
                } else {
                    playCommand(guild, { noAnnouce: true });
                }
            } else if (react.toString() === '⏹') {
                stopCommand(guild);
            } else if (react.toString() === '⏭') {
                playNext(guild);
            } else if (react.toString() === 'ℹ') {
                playlistCommand(guild);
            }

            await reaction.remove(user);
        }
    };
};