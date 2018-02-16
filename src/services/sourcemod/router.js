import Express from 'express';
import debug from 'debug';
import request from 'request-promise';

import MessageService from './messages';

const router = Express.Router();
const log = debug('skeets:service:sourcemod');

export default (app, models) => {
    const connection = app.service('connection');
    const Socket = connection.socket;
    const Client = models.Client;
    const Room = models.Room;
    const messageService = MessageService(app);

    const setClientLocation = (id, server) => {
        if (Client.get(id)) {
            Client.get(id).location = server;
        }
    };

    const filterIP = (ip, final) => {
        if (!ip)
            return final;

        if (ip === 'localhost' || ip === '127.0.0.1') {
            return final;
        }

        return ip;
    };

    Socket.on('connection', (socket) => {
        socket.on('auth', (id) => {
            try {
                const client = Client.get(id);
                client.socket = socket;

                if (client.room) {
                    client.room.join(client);
                }

                log(`Socket Client Connected: ${id}`);
            } catch (error) {
                log(error);
            }
        });

        log('Socket Client Connected');
    });

    router.get('/action', async (req, res) => {
        const action = req.query.action;
        const author = req.query.author;
        const server = {
            client: req.query.client,
            port: req.query.port,
            ip: filterIP(req.query.ip, req.connection.remoteAddress.replace(/^.*:/, ''))
        };

        log(`Command ${action} by ${author}`);

        setClientLocation(author, server);

        const data = {
            author,
            server
        };

        if (action === 'music.query') {
            log(`Search for ${req.query.search} from ${author}`);

            if (req.query.search) {
                data.query = req.query.search;
            } else {
                throw new Error('Music query was called without search query');
            }
        }

        app.callAction('sourcemod', action, data);

        res.send('OK');
    });

    router.get('/chat', async (req, res) => {
        try {
            const text = req.query.message;
            const author = req.query.author;
            const server = {
                client: req.query.client,
                port: req.query.port,
                ip: filterIP(req.query.ip, req.connection.remoteAddress.replace(/^.*:/, ''))
            };

            log(`Message ${text} by ${author}`);

            setClientLocation(author, server);

            messageService.handle(text, author, server);

            res.send('OK');
        } catch (error) {
            log(error);
        }
    });

    router.get('/connect', async (req, res) => {
        try {
            if (!req.query.id)
                throw new Error('No ID supplied');

            const server = {
                client: req.query.client,
                port: req.query.port,
                ip: filterIP(req.query.ip, req.connection.remoteAddress.replace(/^.*:/, ''))
            };

            const id = req.query.id;

            Client.create(id);
            setClientLocation(id, server);

            log(`Serving to ${id}`);

            res.render('play', { id });

            const text = 'Connected!';
            await request(`http://${server.ip}:${server.port}/skeets/chat_client?type=1&text=${text}&client=${server.client}`);
        } catch (error) {
            log(error);
        }
    });

    router.get('/room', async (req, res) => {
        try {
            if (!req.query.id)
                throw new Error('No ID supplied');

            const server = {
                client: req.query.client,
                port: req.query.port,
                ip: filterIP(req.query.ip, req.connection.remoteAddress.replace(/^.*:/, ''))
            };

            const id = req.query.id;

            const client = Client.create(id);
            setClientLocation(id, server);

            if (req.query.room) {
                const room = Room.get(req.query.room);
                client.room = room;

                const text = `Connected to room with id ${room.id}!`;
                await request(`http://${server.ip}:${server.port}/skeets/chat_client?type=1&text=${text}&client=${server.client}`);
            } else {
                let text;

                if (client.room) {
                    text = 'You are already in a roomm use !stop to leave';
                } else {
                    const room = Room.create(client);
                    client.room = room;
                    text = `Created room with id ${room.id}!`;
                }

                await request(`http://${server.ip}:${server.port}/skeets/chat_client?type=1&text=${text}&client=${server.client}`);
            }

            res.render('play', { id });

            log(`Creating to ${id}`);

        } catch (error) {
            log(error);
        }
    });

    return router;
};