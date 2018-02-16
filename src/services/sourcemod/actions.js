import querystring from 'querystring';
import debug from 'debug';
import request from 'request-promise';

const log = debug('skeets:actions:api');
const CHAT_TYPE = {
    ERROR: 0,
    INFO: 1
};

export default (app, models) => {
    const Client = models.Client;

    app.registerAction('sourcemod', 'default', async () => {
        return app.service('reply').getReply('chat.fail');
    });

    app.registerAction('sourcemod', 'chat', async (data) => {
        log(`Sending text: ${data.reply} to ${data.server.ip}:${data.server.port}`);
        return request(`http://${data.server.ip}:${data.server.port}/skeets/chat?text=${data.reply}`);
    });

    app.registerAction('sourcemod', 'music.query', async (data) => {
        let entities;

        if (data.query) {
            entities = {
                search_query: data.query
            };
        } else {
            entities = data.response.result.parameters;
        }

        log(`Searching for '${entities.search_query}'`);

        try {
            const result = await app.service('youtube').search(entities.search_query);

            if (result.items.length < 0) {
                const text = 'No results were found!';
                const type = CHAT_TYPE.ERROR;

                return request(`http://${data.server.ip}:${data.server.port}/skeets/chat_client?type=${type}&text=${text}&author=${data.author}"&client=${data.server.client}`);
            }

            log(`Found ${result.items.length} results for ${entities.search_query}`);

            const video = result.items[0];
            const videoID = video.id.videoId;
            const info = await app.service('youtube').getInfo(videoID);
            const title = querystring.escape(info.title);
            const artist = querystring.escape(info.author.name);
            const client = Client.get(data.author);

            let text;
            let type = CHAT_TYPE.INFO;

            if (client) {
                if (client.room) {
                    client.room.player.add(videoID);
                } else {
                    client.player.add(videoID);
                }

                text = `Added ${title} by ${artist}`;
            } else {
                text = 'You are not connected, please connect by typing !connect';
                type = CHAT_TYPE.ERROR;
            }

            return request(`http://${data.server.ip}:${data.server.port}/skeets/chat_client?type=${type}&text=${text}&author=${data.author}"&client=${data.server.client}`);
        } catch (error) {
            log(error);

            throw new Error(error);
        }
    });

    app.registerAction('sourcemod', 'player.stop', async (data) => {
        const client = await Client.get(data.author);
        let text = await app.service('reply').getReply('player.info.stopped');

        if (!client) {
            text = 'You are not connected, please connect by typing !connect';
            return request(`http://${data.server.ip}:${data.server.port}/skeets/chat_client?type=0&client=${data.server.client}&text=${text}`);
        }

        log(`Stopping for client ${data.server.client} at ${data.server.ip}:${data.server.port}`);

        if (client.room) {
            client.room.leave(client.id);
        }

        client.player.stop();

        return request(`http://${data.server.ip}:${data.server.port}/skeets/chat_client?type=1&client=${data.server.client}&text=${text}`);
    });

    app.registerAction('sourcemod', 'player.pause', async (data) => {
        const client = await Client.get(data.author);
        let text = await app.service('reply').getReply('player.info.paused');

        if (!client) {
            text = 'You are not connected, please connect by typing !connect';
            return request(`http://${data.server.ip}:${data.server.port}/skeets/chat_client?type=0&client=${data.server.client}&text=${text}`);
        }

        log(`Pausing for client ${data.server.client}(${data.author}) at ${data.server.ip}:${data.server.port}`);

        if (client.room) {
            text = 'Cannot pause while in a room';
        } else {
            client.player.pause();
        }

        return request(`http://${data.server.ip}:${data.server.port}/skeets/chat_client?type=1&client=${data.server.client}&text=${text}`);
    });

    app.registerAction('sourcemod', 'player.play', async (data) => {
        const client = await Client.get(data.author);
        let text = await app.service('reply').getReply('player.info.resume');

        if (!client) {
            text = 'You are not connected, please connect by typing !connect';
            return request(`http://${data.server.ip}:${data.server.port}/skeets/chat_client?type=0&client=${data.server.client}&text=${text}`);
        }

        log(`Resuming for client ${data.server.client}(${data.author}) at ${data.server.ip}:${data.server.port}`);

        if (client.room) {
            text = 'Cannot resume while in a room';
        } else {
            client.player.resume();
        }

        return request(`http://${data.server.ip}:${data.server.port}/skeets/chat_client?type=1&client=${data.server.client}&text=${text}`);
    });

    app.registerAction('sourcemod', 'player.forward', async (data) => {
        const client = await Client.get(data.author);

        if (!client) {
            const text = 'You are not connected, please connect by typing !connect';
            return request(`http://${data.server.ip}:${data.server.port}/skeets/chat_client?type=0&client=${data.server.client}&text=${text}`);
        }

        log(`Skipping for client ${data.server.client}(${data.author}) at ${data.server.ip}:${data.server.port}`);

        if (client.room) {
            if (client.room.admin.id === data.author)
                client.player.next();
            else {
                const text = 'Only the room creator can do that';
                return request(`http://${data.server.ip}:${data.server.port}/skeets/chat_client?type=1&client=${data.server.client}&text=${text}`);
            }
        } else {
            client.player.next();
        }
    });

    app.registerAction('sourcemod', 'player.backward', async (data) => {
        const client = await Client.get(data.author);

        if (!client) {
            const text = 'You are not connected, please connect by typing !connect';
            return request(`http://${data.server.ip}:${data.server.port}/skeets/chat_client?type=0&client=${data.server.client}&text=${text}`);
        }

        log(`Going back for client ${data.server.client}(${data.author}) at ${data.server.ip}:${data.server.port}`);

        if (client.room) {
            if (client.room.admin.id === data.author)
                client.player.previous();
            else {
                const text = 'Only the room creator can do that';
                return request(`http://${data.server.ip}:${data.server.port}/skeets/chat_client?type=1&client=${data.server.client}&text=${text}`);
            }
        } else {
            client.player.previous();
        }
    });
};