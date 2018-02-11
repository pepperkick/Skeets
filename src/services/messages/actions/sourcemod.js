import querystring from 'querystring';
import debug from 'debug';
import request from 'request-promise';

const log = debug('skeets:actions:api');

export default (app) => {
    app.registerAction('sourcemod', 'default', async () => {
        return app.service('reply').getReply('chat.fail');
    });

    app.registerAction('sourcemod', 'chat', async (data) => {
        log(`Sending text: ${data.reply} to ${data.server.ip}:${data.server.port}`);
        return request(`http://${data.server.ip}:${data.server.port}/skeets/chat?text=${data.reply}`);
    });

    app.registerAction('sourcemod', 'music.query', async (data) => {
        const entities = data.response.result.parameters;

        log(`Searching for '${entities.search_query}'`);

        try {
            const result = await app.service('youtube').search(entities.search_query);

            if (result.items.length < 0) {
                throw new Error('No result');
            }

            log(`Found ${result.items.length} results for ${entities.search_query}`);

            const video = result.items[0];
            const videoID = video.id.videoId;
            const info = await app.service('youtube').getInfo(videoID);
            const title = querystring.escape(info.title);
            const artist = querystring.escape(info.author.name);

            return request(`http://${data.server.ip}:${data.server.port}/skeets/playerurl?url="http://chillypunch.com:7587/api/yt?part=${videoID}"&client=${data.server.client}&title=${title}&artist=${artist}`);
        } catch (error) {
            log(error);

            throw new Error(error);
        }
    });

    app.registerAction('sourcemod', 'player.stop', async (data) => {
        log(`Stopping for client ${data.server.client} at ${data.server.ip}:${data.server.port}`);
        return request(`http://${data.server.ip}:${data.server.port}/skeets/playerstop?client=${data.server.client}`);
    });
};