import request from 'request-promise';
import config from 'config';
import debug from 'debug';

const log = debug('skeets:service:cleverbot');
const sessions = {};


export default (app) => {
    return {
        getReply: async (session, text) => {
            if (!sessions[session]) {
                const res = await request.post({
                    url: 'https://cleverbot.io/1.0/create',
                    body: {
                        user: config.get('service.cleverbotio.app'),
                        key: config.get('service.cleverbotio.secret'),
                        nick: session
                    },
                    json: true
                });

                log(res);
            }

            const response = await request.post({
                url: 'https://cleverbot.io/1.0/ask',
                body: {
                    user: config.get('service.cleverbotio.app'),
                    key: config.get('service.cleverbotio.secret'),
                    nick: session,
                    text
                },
                json: true
            });
            const reply = response.response;

            sessions[session] = true;

            log(reply);

            if (!reply) {
                throw new Error('No reply from cleverbot');
            }

            return reply;
        }
    };
};