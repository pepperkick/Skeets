import Express from 'express';
import ExpressWs from 'express-ws';
import debug from 'debug';
import url from 'valid-url';
import ytdl from 'ytdl-core';

const express = new Express();
const log = debug('skeets:service:express');

ExpressWs(express);

export default (app) => {
    express.enable('trust proxy');

    express.get('/api/yt', async (req, res) => {
        try {
            if (!req.query.part)
                throw new Error('No URL or ID supplied');

            let videoID;

            if (url.isUri(req.query.part)) {
                const url = req.query.part;

                let parts = url.split('v=')[1];
                parts = parts != undefined ? parts : url.split('youtu.be/')[1];

                videoID = parts.split('&')[0];
            } else {
                videoID = req.query.part;
            }

            const stream = await app.service('youtube').getStream(videoID);
            stream.pipe(res);
        } catch (error) {
            log(error);

            return res.sendStatus(404);
        }
    });

    express.get('/api/chat', async (req, res) => {
        try {
            const text = req.query.message;
            const author = req.query.author;
            const client = req.query.client;
            const ip = req.query.ip;
            const port = req.query.port;

            log(`Message ${text} by ${author}`);

            app.service('messages').handleSourcemod(text, author, {
                ip,
                port,
                client
            });

            res.send('OK');
        } catch (error) {
            log(error);
        }
    });

    express.listen(7587, () => {
        log('API service started!');
    });
};