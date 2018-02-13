import debug from 'debug';

import actions from './actions';
import router from './router';

const log = debug('skeets:service:sourcemod');

const clients = {};

export default (app) => {
    actions(app);

    setTimeout(() => {
        const connection = app.service('connection');
        const express = connection.express;

        express.use('/api/sourcemod', router(app));

        log('Started service');
    }, 5000);

    const getSocketByID = id => clients[id].socket;

    return {
        getSocketByID
    };
};