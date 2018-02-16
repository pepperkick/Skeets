import debug from 'debug';

export default app => {
    const Player = app.service('models').Player;
    const CON = app.service('models').CON;

    class ClientPlayer extends Player {
        constructor(client, socket) {
            super();

            this._id = client.id;
            this._client = client;
            this._socket = socket;

            this._log = debug(`skeets:service:sourcemod:client:${client.id}`);

            this._log('Player Created');
        }

        add(id) {
            super.add(id);

            this._log(`Added ID: ${id}`);

            if (super.status === CON.STATUS.STOPPED) {
                this.next();
            }
        }

        next() {
            const index = super.next();

            if (index >= 0) {
                this._play(index);
            } else {
                this._client.sendError('playlist_end');
            }
        }

        previous() {
            const index = super.previous();

            if (index >= 0) {
                this._play(index);
            } else {
                this._client.sendError('playlist_end');
            }
        }

        resume() {
            super.resume();
            this._socket.emit('resume');
        }

        pause() {
            super.pause();
            this._socket.emit('pause');
        }

        stop() {
            super.stop();
            this._socket.emit('stop');
        }

        onend() {
            super.onend();
            this.next();
        }

        updatetime(time) {
            super.time = time;
        }

        _play(index) {
            const id = super._play(index);

            this._socket.emit('playurl', `http://chillypunch.com:7587/api/yt?id=${id}`);

            this._log(`Playing ID: ${id}`);

            this._client.sendPlayingInfo(id);
        }
    }

    class RoomPlayer extends Player {
        constructor(room) {
            super();

            this._id = room.id;
            this._room = room;
            this._sockets = {};

            this._log = debug(`skeets:service:sourcemod:room:${room.id}`);

            this._log('Room Player Created');
        }

        join(id, socket) {
            this._sockets[id] = socket;

            if (super.status === CON.STATUS.PLAYING) {
                const item = super.item;

                this._log(`Client joined, playing ${item}`);

                socket.emit('playurl', `http://chillypunch.com:7587/api/yt?id=${item}`);
            }
        }

        leave(id) {
            delete this._sockets[id];
        }

        add(id) {
            super.add(id);

            this._log(`Added ID: ${id}`);

            if (super.status === CON.STATUS.STOPPED) {
                this.next();
            }
        }

        next() {
            const index = super.next();

            if (index >= 0) {
                this._play(index);
            } else {
                this._room.sendError('playlist_end');
            }
        }

        previous() {
            const index = super.previous();

            if (index >= 0) {
                this._play(index);
            } else {
                this._room.sendError('playlist_end');
            }
        }

        resume() {
            super.resume();

            for (const i in this._sockets) {
                this._sockets[i].emit('resume');
            }
        }

        pause() {
            super.pause();
            for (const i in this._sockets) {
                this._sockets[i].emit('pause');
            }
        }

        stop() {
            super.stop();
            for (const i in this._sockets) {
                this._sockets[i].emit('stop');
            }
        }

        onend() {
            super.onend();
            this.next();
        }

        _play(index) {
            const id = super._play(index);

            for (const i in this._sockets) {
                this._log(`Playing ${id} for socket`);
                this._sockets[i].emit('playurl', `http://chillypunch.com:7587/api/yt?id=${id}`);
            }

            this._log(`Playing ID: ${id}`);

            this._room.sendPlayingInfo(id);
        }
    }

    return {
        ClientPlayer,
        RoomPlayer
    };
};