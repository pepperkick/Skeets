import config from 'config';
import debug from 'debug';

const log = debug('skeets:service:messages');
const msgBank = {};

export default (app) => {
    app.registerAction('discord', 'chat.greet', async data => {
        const message = data.message;
        const user = message.author.username;
        const text = app.service('reply').getReply('chat.greet');
        const reply = app.service('reply').processReply.name(text, user);

        await sendMessage(reply, message, true);
    });

    app.registerAction('discord', 'default', async data => {
        const message = data.message;
        const user = message.author.username;
        const text = app.service('reply').getReply('chat.fail');
        const reply = app.service('reply').processReply.name(text, user);

        await sendErrorMessage(reply, message, true);
    });

    const filterMessage = (text) => {
        const alias = config.get('bot.alias');

        if (text.indexOf(config.get('bot.prefix')) === 0) {
            return true;
        }

        for (let i in alias) {
            const name = alias[i];
            const regex = new RegExp(`${name}`, 'gi');

            if (regex.test(text)) {
                return true;
            }
        }

        return false;
    };

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

        app.callAction('discord', action, { message, response });

        processToBank(message.guild ? message.guild.id : session, session, message);
    };

    const sendMessage = async (text, message, options = {}) => {
        let session;
        let channel;
        let guild;

        if (message instanceof Object) {
            session = message.author.id;
            channel = message.channel;
            guild = message.guild;
        } else {
            session = app.service('discord').user.id;
            channel = app.service('discord').channels.get(message);
            guild = channel.guild;
        }

        if (!options.embed) {
            return processToBank(guild ? guild.id : session, session, await channel.send('', {
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
            return processToBank(guild ? guild.id : session, session, await channel.send(text, options));
        }
    };

    const sendInfoMessage = async (text, message) => {
        return await sendMessage('', message, {
            embed: {
                color: app.service('reply').replyColor.normal.cyan,
                description: text,
                timestamp: new Date(),
                footer: {
                    icon_url: config.get('bot.avatar'),
                    text: config.get('bot.name')
                }
            }
        });
    };

    const sendSuccessMessage = async (text, message) => {
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
        handle: (message) => {
            const text = message.content;

            if (!filterMessage(text)) return;

            const dfCb = async (response) => {
                const dfValue = response.result.score;
                const dfAction = response.result.action;

                if (dfValue >= config.get('service.dialogflow.threshold')) {
                    log(`Detected remote action ${dfAction}, DFValue: ${dfValue}`);

                    handleMessage(dfAction, message, response);
                } else {
                    log(`Unable to detect action remotely, falback to default action. DFValue: ${dfValue}`);

                    if (dfValue < 0.5 && filterMessage(text)) {
                        try {
                            const reply = app.service('cleverbot').getReply(message.author.id, text);

                            await sendMessage(reply, message, true);
                        } catch (error) {
                            handleMessage('default', message, response);
                        }
                    } else {
                        handleMessage('default', message, response);
                    }
                }
            };

            requestDialogFlow(message.author.id, text, dfCb);
        },
        handleSourcemod: (text, author, server) => {
            const dfCb = async (response) => {
                const dfValue = response.result.score;
                const dfAction = response.result.action;

                if (dfValue >= config.get('service.dialogflow.threshold')) {
                    log(`Detected remote action ${dfAction}, DFValue: ${dfValue}`);

                    app.callAction('sourcemod', dfAction, { server, author, response });
                } else {
                    log(`Unable to detect action remotely, falback to default action. DFValue: ${dfValue}`);

                    if (dfValue < config.get('service.dialogflow.threshold')) {
                        try {
                            const reply = await app.service('cleverbot').getReply(author, text);

                            app.callAction('sourcemod', 'chat', { reply, author, server });
                        } catch (error) {
                            app.callAction('sourcemod', 'default', { server });
                        }
                    } else {
                        app.callAction('sourcemod', 'default', { server });
                    }
                }
            };

            requestDialogFlow(author, text, dfCb);
        },
        sendMessage,
        sendSuccessMessage,
        sendInfoMessage,
        sendErrorMessage,
        filterMessage
    };
};