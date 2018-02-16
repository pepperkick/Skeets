import Server from 'http';
import Express from 'express';
import Socket from 'socket.io';
import debug from 'debug';
import config from 'config';

import apiRouter from './api';

const express = new Express();
const server = Server.createServer(express);
const socket = new Socket(server);
const log = debug('skeets:service:connection');
const viewPaths = [];

export default (app) => {
    express.enable('trust proxy');
    express.set('view engine', 'ejs');

    express.use('/api', apiRouter(app));

    server.listen(config.get('service.connection.port'), () => {
        log('Service Started!');
    });

    const connInfo = {
        ip: config.get('service.connection.ip'),
        port: config.get('service.connection.port')
    };

    const addViewPath = (path) => {
        viewPaths.push(path);

        express.set('views', viewPaths);
    };

    return {
        addViewPath,
        connInfo,
        express,
        socket
    };
};