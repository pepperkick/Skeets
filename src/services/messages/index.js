import config from 'config';
import debug from 'debug';

const log = debug('eve:service:messages');

export default (app) => {
    return {
        handle: message => {
            const natural = app.service('natural');
            const text = message.content;
            const result = natural.classify(text);

            if (result[0].value >= config.get('classifier.localThreshold')) {
                log(result);
            } else {
                log('No actions meet minimum local threshold for message', text);
            }
        }
    };
};