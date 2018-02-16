import config from 'config';
import debug from 'debug';

const log = debug('skeets:service:discord:messages');
const msgBank = {};

export default (app) => {
    const replyService = app.service('reply');

    app.registerAction('discord', 'chat.greet', async data => {
        const message = data.message;
        const user = message.author.username;
        const text = replyService.getReply('chat.greet');
        const reply = replyService.processReply.name(text, user);

        await sendMessage(reply, message, true);
    });

    app.registerAction('discord', 'default', async data => {
        const message = data.message;
        const user = message.author.username;
        const text = replyService.getReply('chat.fail');
        const reply = replyService.processReply.name(text, user);

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
        const channel = message.channel;
        const guild = message.guild.id;

        if (!options.embed) {
            return processToBank(guild, channel.id, await channel.send('', {
                embed: {
                    color: replyService.replyColor.normal.cyan,
                    description: text,
                    timestamp: new Date(),
                    footer: {
                        icon_url: config.get('bot.avatar'),
                        text: config.get('bot.name')
                    }
                }
            }));
        } else {
            return processToBank(guild, channel.id, await channel.send(text, options));
        }
    };

    const sendInfoMessage = async (text, message) => {
        return await sendMessage('', message, {
            embed: {
                color: replyService.replyColor.normal.cyan,
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
                color: replyService.replyColor.normal.green,
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
                color: replyService.replyColor.normal.amber,
                description: text,
                timestamp: new Date(),
                footer: {
                    icon_url: config.get('bot.avatar'),
                    text: config.get('bot.name')
                }
            }
        });
    };

    const processToBank = (guild, channel, message) => {
        if (!msgBank[guild])
            msgBank[guild] = [];

        if (!msgBank[guild][channel])
            msgBank[guild][channel] = [];

        msgBank[guild][channel].push(message);

        return message;
    };

    const checkIfGroupable = async () => {
        if (!config.get('message.autoGroupMessages')) return;

        for (const guild in msgBank) {
            for (const channel in msgBank[guild]) {
                const msgs = msgBank[guild][channel];

                if (msgs.length > config.get('message.groupMessages')) {
                    let text = '';

                    log(`Grouping messages from ${channel}:${guild}`);

                    if (!msgs[0]) throw new Error('Unable to group messages');

                    for (var i = 0; i < msgs.length; i++) {
                        if (msgs[i].content === '')
                            text += `**${msgs[i].author.username}**: ${msgs[i].embeds[0].description}\n`;
                        else
                            text += `**${msgs[i].author.username}**: ${msgs[i].content}\n`;

                        if (guild !== channel)
                            msgs[i].delete();
                    }

                    await sendMessage('', msgs[0], {
                        embed: {
                            color: replyService.replyColor.normal.purple,
                            title: 'Conversation',
                            description: text,
                            timestamp: new Date(),
                            footer: {
                                icon_url: config.get('bot.avatar'),
                                text: config.get('bot.name')
                            }
                        }
                    });

                    msgBank[guild][channel] = [];
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

                    if (dfValue < 0.5) {
                        try {
                            const reply = await app.service('cleverbot').getReply(message.author.id, text);

                            await sendMessage(reply, message);
                        } catch (error) {
                            log(error);

                            handleMessage('default', message, response);
                        }
                    } else {
                        handleMessage('default', message, response);
                    }
                }
            };

            requestDialogFlow(message.author.id, text, dfCb);
        },
        sendMessage,
        sendSuccessMessage,
        sendInfoMessage,
        sendErrorMessage,
        filterMessage
    };
};