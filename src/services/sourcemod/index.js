import Server from 'http';
import Express from 'express';
import ExpressWs from 'express-ws';
import Socket from 'socket.io';
import debug from 'debug';
import urlval from 'valid-url';
import ffmpeg from 'fluent-ffmpeg';

import actions from './actions';

const express = new Express();
const server = Server.createServer(express);
const socket = new Socket(server);
const log = debug('skeets:service:express');
const clients = {};

ExpressWs(express);

socket.on('connection', (client) => {
    let author;

    client.on('auth', (id) => {
        clients[id] = {
            socket: client
        };

        author = id;

        log(`Socket Client Connected as ${id}`);
    });

    client.on('played', (data) => {
        if (!author) return log('Client not authenticated');

        clients[author].played = Math.floor(data.time);
        clients[author].id = data.id;
    });

    log('Socket Client Connected');
});

export default (app) => {
    actions(app);

    express.enable('trust proxy');
    express.set('view engine', 'ejs');
    express.set('views', `${__dirname}/views`);

    express.get('/api/yt', async (req, res) => {
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

    express.get('/api/sourcemod/action', async (req, res) => {
        const action = req.query.action;
        const author = req.query.author;
        const client = req.query.client;
        const port = req.query.port;
        let ip = req.query.ip;

        log(`Command ${action} by ${author}`);

        if (ip === 'localhost' || ip === '127.0.0.1') {
            ip = req.connection.remoteAddress.replace(/^.*:/, '');
        }

        const data = {
            author,
            server: {
                ip,
                port,
                client
            }
        };

        app.callAction('sourcemod', action, data);

        res.send('OK');
    });

    express.get('/api/sourcemod/chat', async (req, res) => {
        try {
            const text = req.query.message;
            const author = req.query.author;
            const client = req.query.client;
            const port = req.query.port;
            let ip = req.query.ip;

            log(`Message ${text} by ${author}`);

            if (ip === 'localhost' || ip === '127.0.0.1') {
                ip = req.connection.remoteAddress.replace(/^.*:/, '');
            }

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

    express.get('/api/sourcemod/play', async (req, res) => {
        try {
            if (!req.query.part)
                throw new Error('No URL or ID supplied');

            if (!req.query.author)
                throw new Error('No author ID supplied');

            let videoID;

            if (urlval.isUri(req.query.part)) {
                const url = req.query.part;

                let parts = url.split('v=')[1];
                parts = parts != undefined ? parts : url.split('youtu.be/')[1];

                videoID = parts.split('&')[0];
            } else {
                videoID = req.query.part;
            }

            const author = req.query.author;
            let seek, audioUrl;

            if (clients[author] && clients[author].id === videoID && req.query.seek) {
                seek = clients[author].played;
                log(`Found recent data for client ${author}: ${seek}`);
            }

            audioUrl = `http://chillypunch.com:7587/api/yt?id=${videoID}`;
            if (seek) audioUrl += `&seek=${seek}`;

            log(`Serving ${audioUrl} to ${author}`);

            res.render('play', {
                url: audioUrl,
                id: videoID,
                author
            });
        } catch (error) {
            log(error);
        }
    });

    server.listen(7587, () => {
        log('API service started!');
    });

    const getSocketByID = id => clients[id].socket;

    return {
        getSocketByID
    };
};