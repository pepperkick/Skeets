import CON from '../constants';

class Player {
    constructor() {
        this._playlist = {
            index: -1,
            items: []
        };
        this._status = CON.STATUS.STOPPED;
    }

    add(id) {
        this._playlist.items.push(id);
    }

    next() {
        const index = this._playlist.index + 1;
        const item = this._playlist.items[index];

        if (item) {
            return index;
        }

        return -1;
    }

    previous() {
        let index = this._playlist.index;

        if (this._status !== CON.STATUS.STOPPED) {
            index--;
        }

        const item = this._playlist.items[index];

        if (item) {
            return index;
        }

        return -1;
    }

    resume() {
        this._status = CON.STATUS.PLAYING;
    }

    pause() {
        this._status = CON.STATUS.PAUSED;
    }

    stop() {
        this._status = CON.STATUS.STOPPED;
        this._playlist = {
            index: -1,
            items: []
        };
    }

    onend() {
        this._status = CON.STATUS.STOPPED;
    }

    _play(index) {
        const id = this._playlist.items[index];
        this._playlist.index = index;

        this._status = CON.STATUS.PLAYING;

        return id;
    }

    get status() { return this._status; }
    get item() { return this._playlist.items[this._playlist.index]; }

    get time() { return this._time; }
    set time(time) { this._time = time; }
}

export default Player;