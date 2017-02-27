'use strict';

const http = require('http');
const bole = require('bole');
const express = require('express');
const compress = require('compression')();
const cors = require('cors');
const config = require('../config/config.js');
const Lib = require('../');

const app = express();
const log = bole('app');

// Configure logging
bole.output({
    level: config.get('logLevel'),
    stream: process.stdout,
});

// Set up the library this app exposes
const lib = new Lib();

// Configure application
app.disable('x-powered-by');
app.enable('trust proxy');

// Set middleware
app.use(compress);
app.use(cors());

// Attach lib routers
app.use('/', lib.router());

// Log errors
app.use((error, req, res, next) => {
    log.error(error);
    next(error);
});

// Send error status pages
app.use((error, req, res) => {
    const accepts = req.xhr ? 'json' : req.accepts(['html', 'json', 'text']);
    switch (accepts) {
        case 'json':
            res.status(error.output.payload.statusCode).json(error.output.payload);
            break;
        case 'html':
            res.status(error.output.payload.statusCode).send(`<html><body><h1>${error.output.payload.error}</h1></body></html>`);
            break;
        case 'text':
            res.status(error.output.payload.statusCode).send(error.output.payload.error);
            break;
        default:
            res.status(406).send('Not Acceptable');
    }
});

// Set up http server and Export application
module.exports = http.createServer(app);
