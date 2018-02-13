import Express from 'express';
import debug from 'debug';

const router = Express.Router();
const log = debug('skeets:service:connection:api');

export default app => {
    router.get('/yt', async (req, res) => {
        try {
            if (!req.query.id)
                throw new Error('No URL or ID supplied');

            let videoID = req.query.id;

            log(videoID);

            const stream = await app.service('youtube').getStream(videoID);

            stream.pipe(res);
        } catch (error) {
            log(error);

            return res.sendStatus(404);
        }
    });

    return router;
}