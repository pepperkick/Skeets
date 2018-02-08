import fs from 'fs';
import del from 'del';
import debug from 'debug';

const log = debug('skeets:service:file');
const streamOptions = { seek: 0, volume: 0.5, passes: 3 };
const fileManager = {};
const streamManager = {};

export default async (app) => {
    const cacheFile = async (id) => {
        const youtube = app.service('youtube');

        return new Promise(async (resolve, reject) => {
            try {
                const path = `./cache/${id}.cache`;
                const stream = await youtube.getStream(id);
                const writeStream = fs.createWriteStream(path, streamOptions);

                streamManager[id] = {
                    stream,
                    path
                };

                stream.pipe(writeStream);

                stream.on('progress', (len, done, total) => {
                    log(`${done} / ${total}`);
                });

                stream.on('end', () => {
                    delete streamManager[id];

                    log('Cache Finished!');

                    fileManager[id] = writeStream;

                    resolve(writeStream);
                });
            } catch (error) {
                reject(error);
            }
        });
    };

    return {
        cache: (id) => {
            if (fileManager[id])
                return fileManager[id];

            return cacheFile(id);
        },
        clean: () => del.sync('./cache/*'),
        getFile: id => {
            if (streamManager[id]) {
                log('Cache inturupted!');

                streamManager[id].stream.destroy();

                del.sync(streamManager[id].path);
            }

            return fileManager[id];
        }
    };
};