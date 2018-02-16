import config from 'config';
import debug from 'debug';

const log = debug('skeets:service:sourcemod:messages');

export default app => {
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

    return {
        handle: (text, author, server) => {
            const dfCb = async (response) => {
                const dfValue = response.result.score;
                const dfAction = response.result.action;

                if (dfValue >= config.get('service.dialogflow.threshold')) {
                    log(`Detected remote action ${dfAction}, DFValue: ${dfValue}`);

                    app.callAction('sourcemod', dfAction, { server, author, response });
                } else {
                    log(`Unable to detect action remotely, falback to default action. DFValue: ${dfValue}`);

                    if (dfValue < 0.5) {
                        try {
                            const reply = await app.service('cleverbot').getReply(author, text);

                            app.callAction('sourcemod', 'chat', { server, author, reply });
                        } catch (error) {
                            log(error);
                        }
                    }
                }
            };

            requestDialogFlow(author, text, dfCb);
        }
    };
};