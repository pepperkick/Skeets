import request from 'request-promise';
import ytdl from 'ytdl-core';
import config from 'config';
import Debug from 'debug';

const log = Debug('eve:service:youtube');

export default async () => {
    const key = config.get('service.youtube.apikey');

    const search = async (q) => {
        const options = {
            uri: 'https://www.googleapis.com/youtube/v3/search',
            qs: {
                part: 'snippet',
                key,
                q,
                maxResults: 5
            },
            headers: {
                'User-Agent': 'Request-Promise'
            },
            json: true
        };

        log(`Querying youtube for ${q}`);

        return request(options);
    };

    const getStream = async (id) => {
        const url = `https://www.youtube.com/watch?v=${id}`;

        return await ytdl(url, { filter: 'audioonly', quality: 'lowest', retries: 3 });
    };

    const getInfo = async (id) => {
        const url = `https://www.youtube.com/watch?v=${id}`;

        return await ytdl.getInfo(url);
    };

    return {
        search,
        getStream,
        getInfo
    };
};