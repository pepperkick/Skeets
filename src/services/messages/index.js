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
        const session = message.author.id;
        const guild = message.guild.id;

        const sentMsg = await sendMessage(reply, message, true);

        processToBank(guild, session, message);
        processToBank(guild, session, sentMsg);

        checkIfGroupable(guild, session);
    };

    const sendMessage = (reply, message, embed, options={}) => message.channel.send(embed ? '' : reply, embed ? {
        embed: {
            color: handleReply.replyColor.normal.green,
            description: reply,
            timestamp: new Date(),
            footer: {
                icon_url: config.get('bot.avatar'),
                text: config.get('bot.name')
            }
        }
    } : options);

    const processToBank = (guild, session, message) => {
        if (!msgBank[guild])
            msgBank[guild] = [];

        if (!msgBank[guild][session])
            msgBank[guild][session] = [];

        msgBank[guild][session].push(message);
    };

    const checkIfGroupable = async (guild, session) => {
        if (!config.get('message.autoGroupMessages')) return;

        const msgs = msgBank[guild][session];

        if (msgs.length > config.get('message.groupMessages')) {
            let text = '';

            for (var i = 0; i < msgs.length; i++) {
                if (msgs[i].content === '')
                    text += `**${msgs[i].author.username}**: ${msgs[i].embeds[0].description}\n`;
                else
                    text += `**${msgs[i].author.username}**: ${msgs[i].content}\n`;
                msgs[i].delete();
            }

            const reply = await sendMessage('', msgs[0], false, {
                embed: {
                    color: handleReply.replyColor.normal.purple,
                    title: 'Conversation',
                    description: text,
                    timestamp: new Date(),
                    footer: {
                        icon_url: config.get('bot.avatar'),
                        text: config.get('bot.name')
                    }
                }
            });

            msgBank[guild][session] = [];
            msgBank[guild][session].push(reply);
        }
    };

    return {
        handle: message => {
            const natural = app.service('natural');
            const text = message.content;
            const result = natural.classify(text);

            let nlpValue = 0;
            let nlpAction = 'unknwon';

            if (result.length !== 0) {
                nlpValue = result[0].value;
                nlpAction = result[0].label;
            }

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
        },
        replyHandler: handleReply
    };
};