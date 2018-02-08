import LastfmAPI from 'lastfmapi';
import config from 'config';

const lastfm = new LastfmAPI({
    'api_key': config.get('service.lastfm.apikey'),
    'secret': config.get('service.lastfm.secret')
});

export default async () => {
    const getInfo = track => {
        return new Promise((resolve, reject) => {
            lastfm.track.search({
                limit: 3,
                track
            }, (error, result) => {
                if (error) return reject(error);

                resolve(result.trackmatches.track[0]);
            });
        });
    };

    return {
        getInfo
    };
};