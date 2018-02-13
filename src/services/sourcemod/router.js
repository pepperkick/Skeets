import Express from 'express';
import debug from 'debug';
import urlval from 'valid-url';

const router = Express.Router();
const log = debug('skeets:service:sourcemod');
const clients = {};

export default app => {
    const connection = app.service('connection');
    const socket = connection.socket;

    socket.on('connection', (client) => {
        let author;

        client.on('auth', (id) => {
            clients[id].socket = client;

            author = id;

            client.emit('playurl', `http://chillypunch.com:7587/api/yt?id=${clients[id].videoID}`)

            log(`Socket Client Connected as ${id}`);
        });

        client.on('played', (data) => {
            if (!author) return log('Client not authenticated');

            clients[author].played = Math.floor(data.time);
            clients[author].id = data.id;
        });

        client.on('play', (data) => {
            if (!author) return log('Client not authenticated');

            clients[author].played = Math.floor(data.time);
            clients[author].id = data.id;
        });

        log('Socket Client Connected');
    });

    router.get('/action', async (req, res) => {
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

    router.get('/chat', async (req, res) => {
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

    router.get('/play', async (req, res) => {
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

            if (clients[author])
                clients[author].videoID = videoID;
            else
                clients[author] = { videoID };

            log(`Serving to ${author}`);

            res.render('play', {
                author
            });
        } catch (error) {
            log(error);
        }
    });

    return router;
}