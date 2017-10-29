import apiai from 'apiai';
import config from 'config';

const bot = apiai(config.get('service.dialogflow.apikey'));

export default (app) =>{
    return {
        classify: (session, text) => bot.textRequest(text, { sessionId: session })
    };
};