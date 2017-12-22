import fs from 'fs';

export default async (app) => {
    const voice = app.service('discordVoice');
    const youtube = app.service('youtube');
    const players = {};
    const streamOptions = { seek: 0, volume: 0.5, passes: 3 };

    const queue = async (guild, id) => {
        if (players[guild]) {
            const status = getPlayerStatus(guild);

            await addToPlaylist(guild, id);

            if (status === 'stopped') {
                await playNext(guild, id);
            }
        } else {
            await createPlayer(guild);
            await addToPlaylist(guild, id);
            await playNext(guild, id);
        }
    };

    const playNext = async (guild) => {
        const index = getPlayerIndex(guild);
        const next = getPlaylistIndex(index + 1);

        if (next) {
            play(guild, next);
        } else {
            // TODO: Send playlist end message
        }
    };

    const play = async (guild, id) => {
        const file = await cacheStream(guild, id);
        const dispatcher = getPlayerConnection(guild).playFile(file);

        setPlayerStatus(guild, 'playing');
        setPlayerDispatcher(guild, dispatcher);
    };

    const cacheStream = async (guild, id) => {
        new Promise((resolve, reject) => {
            try {
                const path = `./cache/${guild}.cache`;
                const stream = youtube.getStream(id);
                const writeStream = fs.createWriteStream(path, streamOptions);

                stream.pipe(writeStream);

                stream.on('end', () => {
                    resolve(writeStream);
                });
            } catch (error) {
                reject(error);
            }
        });
    };

    const createPlayer = async (guild) => {
        const voiceConnection = voice.getConnection(guild);
        const player = {};

        player.playlist = [];
        player.status = 'stopped';
        player.index = -1;
        player.connection = voiceConnection;

        players[guild] = player;
    };

    const addToPlaylist = (guild, id) => players[guild].push(id);
    const getPlaylistIndex = (guild, index) => players[guild].playlist[index];

    const getPlayerStatus = (guild) => players[guild].status;
    const getPlayerIndex = (guild) => players[guild].index;
    const getPlayerConnection = (guild) => players[guild].connection;

    const setPlayerStatus = (guild, status) => players[guild].status = status;
    const setPlayerDispatcher = (guild, dispatcher) => players[guild].dispatcher = dispatcher;

    return {
        queue
    };
};