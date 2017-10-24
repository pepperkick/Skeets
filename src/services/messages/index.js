import config from 'config';
import debug from 'debug';

import getReply from './reply';

const log = debug('eve:service:messages');

export default (app) => {
    const requestDialogFlow = (session, text, callback) => {
        const request = app.service('dialogflow').classify(session, text);

        request.on('response', (response) => {
            callback(response);
        });

        request.on('error', (error) => {
            throw new Error('Error during dialogflow request', error);
        });

        request.end();
    };

    const handleMessage = (action, message) => {
        const reply = getReply(action);

        message.reply(reply);
    };

    return {
        handle: message => {
            const natural = app.service('natural');
            const text = message.content;
            const result = natural.classify(text);
            const nlpValue = result[0].value;
            const nlpAction = result[0].label;

            if (nlpValue >= config.get('classifier.localThreshold')) {
                log('Detected action', nlpAction);

                handleMessage(nlpAction, message);
            } else {
                const dfCb = (response) => {
                    const dfValue = response.result.score;
                    const dfAction = response.result.action;

                    if (dfValue >= config.get('classifier.remoteThreshold')) {
                        log(`Detected remote action ${dfAction}, teaching local nlp`);

                        natural.train(text, dfAction);
                        handleMessage(dfAction, message);
                    } else {
                        log('Unable to detect action remotely, falback to default action');
                    }
                };

                log('Unable to detect action locally, sending request to dialogflow');
                requestDialogFlow(message.author.id, text, dfCb);
            }
        }
    };
};