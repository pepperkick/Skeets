import uuid from 'uuid/v1';
import debug from 'debug';

import Player from './Player';

export default app => {
    const RoomPlayer = Player(app).RoomPlayer;

    class Room {
        constructor(id, admin) {
            this.id = id;
            this._admin = admin;
            this.player = new RoomPlayer(this);
            this._members = {};

            this._log = debug(`skeets:service:sourcemod:room:${id}`);
        }

        static create(client) {
            const id = uuid();
            const room = new Room(id, client);

            this._lookup[id] = room;

            return room;
        }

        static get(id) {
            return this._lookup[id];
        }

        join(client) {
            this._members[client.id] = client;
            this.player.join(client.id, client.socket);

            client.room = this;

            this._log(`Client ${client.id} connected`);

            client.socket.on('disconnect', () => {
                delete this._members[client.id];

                if (client.id === this._admin.id) {
                    if (this._members[0])
                        this._admin = this._members[0];
                }

                this.player.leave(client.id);
            });

            if (client.id === this._admin.id) {
                client.socket.on('end', () => {
                    this.player.onend();
                });
            }
        }

        leave(id) {
            delete this._members[id];

            if (id === this._admin.id) {
                if (this._members[0])
                    this._admin = this._members[0];
            }
        }

        sendPlayingInfo(id) {
            for (const i in this._members) {
                this._members[i].sendPlayingInfo(id);
            }
        }

        sendError(error) {
            for (const i in this._members) {
                this._members[i].sendError(error);
            }
        }
    }

    Room._lookup = {};

    return Room;
};