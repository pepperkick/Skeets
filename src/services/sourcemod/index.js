import debug from 'debug';

import actions from './actions';
import router from './router';

import ClientClass from './objects/Client';
import RoomClass from './objects/Room';

const log = debug('skeets:service:sourcemod');

export default (app) => {
    setTimeout(() => {
        const connection = app.service('connection');
        const express = connection.express;
        const models = {
            Client: ClientClass(app),
            Room: RoomClass(app)
        };

        express.use('/api/sourcemod', router(app, models));

        connection.addViewPath(`${__dirname}/views`);

        actions(app, models);

        log('Started service!');
    }, 5000);

    return {};
};