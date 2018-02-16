import querystring from 'querystring';
import debug from 'debug';
import request from 'request-promise';

import Player from './Player';

const log = debug('skeets:service:sourcemod:client');

export default app => {
    const ClientPlayer = Player(app).ClientPlayer;

    class Client {
        constructor(id) {
            this.id = id;
            this._log = debug(`skeets:service:sourcemod:client:${id}`);
        }

        static create(id) {
            if (this._lookup[id]) {
                log(`Client with id ${id} already exists`);

                delete this._lookup[id];
            }

            const client = new this(id);

            this._lookup[id] = client;

            log(`Client created with id ${id}`);

            return client;
        }

        static get(id) {
            if (!this._lookup[id]) {
                log(`Client with id ${id} does not exist`);

                return false;
            }

            return this._lookup[id];
        }

        static destroy(id) {
            if (!this._lookup[id]) {
                log(`Client with id ${id} does not exist`);

                return false;
            }

            delete this._lookup[id];

            return true;
        }

        async sendPlayingInfo(id) {
            if (this._location) {
                const info = await app.service('youtube').getInfo(id);
                const location = this._location;
                const title = querystring.escape(info.title);
                const artist = querystring.escape(info.author.name);
                const text = `[SKEETS]\nNow Playing: ${title} by ${artist}`;

                this._log(`Sending info to ${this.id}`);

                return await request(`http://${location.ip}:${location.port}/skeets/chat_client?type=2&text=${text}&client=${location.client}`);
            }
        }

        async sendError(error) {
            if (this._location) {
                const location = this._location;
                let text;

                if (error === 'playlist_end') {
                    text = 'This is the last song in the playlist';
                } else if (error === 'playlist_start') {
                    text = 'This is the first song in the playlist';
                }

                this._log(`Sending error to ${this.id}`);

                return await request(`http://${location.ip}:${location.port}/skeets/chat_client?type=0&text=${text}&client=${location.client}`);
            }
        }

        get socket() { return this._socket; }
        set socket(socket) {
            this._socket = socket;
            this._player = new ClientPlayer(this, socket);

            this._attachEvents();
        }

        get player() { return this._player; }

        set location(info) { this._location = info; }

        get room() { return this._room; }
        set room(room) { this._room = room; }

        _attachEvents() {
            const socket = this._socket;

            socket.on('end', () => {
                this._player.onend();
            });

            socket.on('disconnect', () => {
                log(`Socket Client Disconnected: ${this.id}`);

                Client.destroy(this.id);
            });
        }
    }

    Client._lookup = {};

    return Client;
};