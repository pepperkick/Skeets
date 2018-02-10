import request from 'request-promise';
import ytdl from 'ytdl-core';
import config from 'config';
import Debug from 'debug';

const log = Debug('skeets:service:youtube');

export default async (app) => {
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

    const playlistInfo = async (id) => {
        const options = {
            uri: 'https://www.googleapis.com/youtube/v3/playlistItems',
            qs: {
                part: 'snippet',
                key,
                playlistId: id
            },
            headers: {
                'User-Agent': 'Request-Promise'
            },
            json: true
        };

        log(`Querying youtube for playlist ${id}`);

        return request(options);
    }

    const getStream = async (id) => {
        try {
            const url = `https://www.youtube.com/watch?v=${id}`;

            return await ytdl(url, { filter: 'audioonly', quality: 'highest', retries: 3 });
        } catch (error) {
            log(error);

            throw new Error(error);
        }
    };

    const getInfo = async (id) => {
        const url = `https://www.youtube.com/watch?v=${id}`;

        return await ytdl.getInfo(url);
    };

    return {
        search,
        playlistInfo,
        getStream,
        getInfo
    };
};