import debug from 'debug';

import services from './services';

const log = debug('eve:services');
const app = {};

app.services = services(app);

process.on('uncaughtException', (err) => {
    log(err);
});

process.on('unhandledRejection', (reason, promise) => {
    log('Unhandled promise rejection', promise);
});
  