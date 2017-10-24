import debug from 'debug';

const log = debug('eve:service:messages');

export default (app) => {
    return {
        handle: message => {
            const text = message.content;
            const result = app.service('natural').classify(text);

            log(result);
        }
    };
};