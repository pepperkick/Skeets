import config from 'config';
import debug from 'debug';

import replyHandler from './reply';

const log = debug('eve:service:messages');
const handleReply = replyHandler();
const msgBank = {};

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

    const handleMessage = async (action, message) => {
        const text = handleReply.getReply(action);
        const reply = handleReply.processReply.name(text, message.author.username);

        const sentMsg = await sendMessage(reply, message);

        processToBank(message.author.id, message);
        processToBank(message.author.id, sentMsg);
    };

    const sendMessage = (reply, message) => message.channel.send(reply);

    const processToBank = (id, message) => {
        if (!msgBank[id])
            msgBank[id] = [];

        msgBank[id].push(message);

        checkIfGroupable(id);
    };

    const checkIfGroupable = async (id) => {
        const msgs = msgBank[id];

        if (msgs.length > 5) {
            let text = '';

            for (var i = 0; i < msgs.length; i++) {
                text += `**${msgs[i].author.username}**: ${msgs[i].content}\n`;
                msgs[i].delete();
            }

            const reply = await sendMessage(text, msgs[0]);

            msgBank[id] = [];
            msgBank[id].push(reply);
        }
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