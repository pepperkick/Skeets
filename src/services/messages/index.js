import config from 'config';
import debug from 'debug';

const log = debug('eve:service:messages');
const msgBank = {};

export default (app) => {
    app.registerAction('chat.greet', async data => {
        const message = data.message;
        const user = message.author.username;
        const text = app.service('reply').getReply('chat.greet');
        const reply = app.service('reply').processReply.name(text, user);

        await sendMessage(reply, message, true);
    });

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

    const handleMessage = (action, message, response) => {
        const session = message.author.id;

        app.callAction(action, { message, response });

        processToBank(message.guild ? message.guild.id : session, session, message);
    };

    const sendMessage = async (text, message, options = {}) => {
        const session = message.author.id;

        if (!options.embed) {
            return processToBank(message.guild ? message.guild.id : session, session, await message.channel.send('', {
                embed: {
                    color: app.service('reply').replyColor.normal.cyan,
                    description: text,
                    timestamp: new Date(),
                    footer: {
                        icon_url: config.get('bot.avatar'),
                        text: config.get('bot.name')
                    }
                }
            }));
        } else {
            return processToBank(message.guild ? message.guild.id : session, session, await message.channel.send(text, options));
        }
    };

    const sendInfoMessage = async (text, message) => {
        return await sendMessage('', message, {
            embed: {
                color: app.service('reply').replyColor.normal.green,
                description: text,
                timestamp: new Date(),
                footer: {
                    icon_url: config.get('bot.avatar'),
                    text: config.get('bot.name')
                }
            }
        });
    };

    const sendErrorMessage = async (text, message) => {
        return await sendMessage('', message, {
            embed: {
                color: app.service('reply').replyColor.normal.amber,
                description: text,
                timestamp: new Date(),
                footer: {
                    icon_url: config.get('bot.avatar'),
                    text: config.get('bot.name')
                }
            }
        });
    };

    const processToBank = (id, session, message) => {
        if (!msgBank[id])
            msgBank[id] = [];

        if (!msgBank[id][session])
            msgBank[id][session] = [];

        msgBank[id][session].push(message);

        return message;
    };

    const checkIfGroupable = async () => {
        if (!config.get('message.autoGroupMessages')) return;

        for (const id in msgBank) {
            for (const session in msgBank[id]) {
                const msgs = msgBank[id][session];

                if (msgs.length > config.get('message.groupMessages')) {
                    let text = '';

                    log(`Grouping messages from ${session}:${id}`);

                    if (!msgs[0]) throw new Error('Unable to group messages');

                    for (var i = 0; i < msgs.length; i++) {
                        if (msgs[i].content === '')
                            text += `**${msgs[i].author.username}**: ${msgs[i].embeds[0].description}\n`;
                        else
                            text += `**${msgs[i].author.username}**: ${msgs[i].content}\n`;

                        if (id !== session)
                            msgs[i].delete();
                    }

                    await sendMessage('', msgs[0], {
                        embed: {
                            color: app.service('reply').replyColor.normal.purple,
                            title: 'Conversation',
                            description: text,
                            timestamp: new Date(),
                            footer: {
                                icon_url: config.get('bot.avatar'),
                                text: config.get('bot.name')
                            }
                        }
                    });

                    msgBank[id][session] = [];
                }
            }
        }
    };

    setInterval(() => {
        checkIfGroupable();
    }, 30 * 1000);

    return {
        handle: message => {
            const text = message.content;

            const dfCb = (response) => {
                const dfValue = response.result.score;
                const dfAction = response.result.action;

                if (dfValue >= config.get('service.dialogflow.threshold')) {
                    log(`Detected remote action ${dfAction}`);

                    handleMessage(dfAction, message, response);
                } else {
                    log('Unable to detect action remotely, falback to default action');

                    //TODO: Implement default action
                }
            };

            requestDialogFlow(message.author.id, text, dfCb);
        },
        sendMessage,
        sendInfoMessage,
        sendErrorMessage
    };
};