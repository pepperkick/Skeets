import debug from 'debug';

import services from './services';

const log = debug('eve:services');
const app = {};

const init = async () => {
    app.service = service => app.services[service];
    app.services = await services(app);
};

process.on('uncaughtException', (err) => {
    log(err);
});

process.on('unhandledRejection', (reason, promise) => {
    log('Unhandled promise rejection', promise);
});

init();