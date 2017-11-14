import debug from 'debug';
import config from 'config';

import services from './services';

const log = debug('eve:services');
const app = {};

const init = async () => {
    app.service = service => app.services[service];
    app.services = await services(app);
};

process.on('uncaughtException', (error) => {
    log(error);
    SendErrorMesage('Fatal Exception', error);
    Shutdown('Fatal Exception');
});

process.on('unhandledRejection', (reason) => {
    log('Unhandled promise rejection', reason);
    SendErrorMesage('Promise Rejection', reason);
});

async function SendErrorMesage(type, error) {
    const discord = app.service('discord');

    try {
        await discord.channels.get(config.get('bot.channel')).send('', {
            embed: {
                color: parseInt('F44336', 16),
                title: 'Something seriously went wrong!',
                description: `${type}: ${JSON.stringify(error)}`,
                timestamp: new Date(),
                footer: {
                    icon_url: config.get('bot.avatar'),
                    text: config.get('bot.name')
                }
            }
        });
    } catch (error) {
        Shutdown('Discord Exception');
    }
}

function Shutdown(info) {
    log('Shutdown due to', info);

    process.exit();
}

init();