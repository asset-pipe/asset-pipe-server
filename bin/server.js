#!/usr/bin/env node

'use strict';

const bole = require('bole');
const config = require('../config/config.js');
const server = require('./app.js');

const log = bole('server');

// Start application
server.listen(config.get('httpServerPort'), () => {
    log.info(`server running at http://localhost:${server.address().port}`);
    log.info(`server process has pid ${process.pid}`);
});

// Catch uncaught exceptions, log it and take down server in a nice way.
// Upstart or forever should handle kicking the process back into life!
process.on('uncaughtException', error => {
    log.error(
        error,
        'shutdown - server taken down by force due to a uncaughtException',
    );
    server.close();
    process.nextTick(() => {
        process.exit(1);
    });
});

// Listen for SIGINT (Ctrl+C) and do a gracefull takedown of the server
process.on('SIGINT', () => {
    log.info('shutdown - got SIGINT - taking down server gracefully');
    server.close();
    process.nextTick(() => {
        process.exit(0);
    });
});

// Listen for SIGTERM (Upstart) and do a gracefull takedown of the server
process.on('SIGTERM', () => {
    log.info('shutdown - got SIGTERM - taking down server gracefully');
    server.close();
    process.nextTick(() => {
        process.exit(0);
    });
});
