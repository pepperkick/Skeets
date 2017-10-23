import debug from 'debug';

import services from './services';

const log = debug('eve:services');
const app = {};

const init = async () => {
    app.services = await services(app);

    app.service = service => app.services[service];
};

process.on('uncaughtException', (err) => {
    log(err);
});

process.on('unhandledRejection', (reason, promise) => {
    log('Unhandled promise rejection', promise);
});

init();