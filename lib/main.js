'use strict';

const EventEmitter = require('events');
const express = require('express');
const SinkMem = require('@asset-pipe/sink-mem');
const Boom = require('boom');
const uuid = require('uuid/v4');
const mime = require('mime-types');
const { Transform } = require('readable-stream');
const params = require('./params');
const assert = require('assert');
const { parseBody, validateFeeds, bundleAndUpload } = require('./utils');

class CheckEmptyPayload extends Transform {
    constructor() {
        super();
        this.chunks = [];
    }

    _transform(chunk, enc, cb) {
        this.chunks.push(chunk);
        cb();
    }

    _flush(cb) {
        const buffered = this.chunks.map(chunk => chunk.toString()).join('');
        let json;
        try {
            json = JSON.parse(buffered);
        } catch (err) {
            const msg =
                'Expected payload provided to `/feed` to be an array ' +
                `of feed objects but instead payload was unparseable. Got ${buffered}`;
            return cb(Boom.badRequest(msg));
        }
        if (json.length) {
            for (const chunk of this.chunks) {
                this.push(chunk);
            }
            cb();
        } else {
            const msg =
                'Expected payload provided to `/feed` to be an array ' +
                `of feed objects but instead got ${buffered}`;
            cb(Boom.badRequest(msg));
        }
    }
}

const ALLOWED_TYPES = ['js', 'css'];

module.exports = class Router extends EventEmitter {
    constructor(sink) {
        super();

        this.sink = sink ? sink : new SinkMem();

        this.app = express.Router(); // eslint-disable-line new-cap

        this.app.use((req, res, next) => {
            res.locals.track = uuid();
            this.emit('request start', res.locals.track, req.method, req.path);
            next();
        });

        this.app.param('file', params.file);

        this.app.post(
            '/feed/js',
            this.postFeedPersistCallback(),
            this.postFeedResponseCallback()
        );

        this.app.post(
            '/feed/css',
            this.postFeedPersistCallback(),
            this.postFeedResponseCallback()
        );

        this.app.get('/feed/:file', this.getFileCallback());

        this.app.post('/bundle/js', this.postBundleHandler('js'));

        this.app.post('/bundle/css', this.postBundleHandler('css'));

        this.app.get('/bundle/:file', this.getFileCallback());
        this.app.get('/test/bundle/:file', this.getTestFileCallback());

        this.app.use((err, req, res, next) => {
            // istanbul ignore else: this catch is just a precaution and we are unsure if it can even happen.
            if (Boom.isBoom(err)) {
                next(err);
            } else {
                next(Boom.boomify(err));
            }
        });

        this.app.use((error, req, res, next) => {
            this.emit(
                'request error',
                res.locals.track,
                req.method,
                req.path,
                res.locals.payload,
                error
            );
            next(error);
        });

        this.app.use(this.statusErrors());
    }

    router() {
        return this.app;
    }

    buildUri(type, host, secure) {
        return `http${secure ? 's' : ''}://${host}/${type}/`;
    }

    postFeedPersistCallback() {
        return (req, res, next) => {
            let uri = this.buildUri('feed', req.headers.host, req.secure);
            const fileWriteStream = this.sink.writer('json');
            fileWriteStream.on('file saved', (id, file) => {
                uri += file;
                res.locals.response = {
                    file,
                    uri,
                    id,
                };
                next();
            });

            fileWriteStream.on(
                'file not saved',
                this.onError(next, 'File not saved')
            );

            fileWriteStream.on('error', this.onError(next));

            req
                .pipe(new CheckEmptyPayload())
                .on('error', next)
                .pipe(fileWriteStream);
        };
    }

    postFeedResponseCallback() {
        return (req, res) => {
            res.json(res.locals.response);
            this.emit(
                'request success',
                res.locals.track,
                req.method,
                req.path,
                res.locals.response.file
            );
        };
    }

    postBundleHandler(type) {
        assert(
            ALLOWED_TYPES.includes(type),
            `Expected type to be 1 of ${ALLOWED_TYPES.join(
                ', '
            )}, but got ${type}`
        );
        return async (req, res, next) => {
            try {
                this.emit('info', `Parsing raw feed data from body`);
                const payload = await parseBody(req, res);
                this.emit(
                    'info',
                    `Successfully parsed feed data from request body. Result: ${JSON.stringify(
                        payload
                    )}`
                );

                this.emit('info', `Validating parsed feed data against schema`);
                const feedIds = validateFeeds(payload);

                this.emit(
                    'info',
                    `Producing and saving asset bundle for requested feeds`
                );
                const response = await bundleAndUpload({
                    sink: this.sink,
                    feedIds,
                    uri: this.buildUri('bundle', req.headers.host, req.secure),
                    type,
                });
                this.emit(
                    'info',
                    `Requested asset bundle produced and successfully uploaded.`
                );

                this.emit(
                    'request success',
                    res.locals.track,
                    req.method,
                    req.path,
                    response.file
                );
                res.json(response);
            } catch (e) {
                next(e);
            }
        };
    }

    onError(next, message) {
        return error => {
            next(Boom.boomify(error, { statusCode: 400, message }));
        };
    }

    onFileNotFound(next) {
        return () => {
            next(Boom.notFound());
        };
    }

    onPipelineEmpty(next) {
        return () => {
            next(
                Boom.badRequest(
                    'Could not load 1 or more of the resources in the payload from storage'
                )
            );
        };
    }

    fileFoundCallback(req, res, fileStream) {
        res.type(mime.lookup(req.params.file) || undefined);
        fileStream.pipe(res);
        this.emit(
            'request success',
            res.locals.track,
            req.method,
            req.path,
            req.params.file
        );
    }

    getFileCallback() {
        return (req, res, next) => {
            const fileReadStream = this.sink.reader(req.params.file);
            fileReadStream.on('file not found', this.onFileNotFound(next));
            fileReadStream.on('file found', () =>
                this.fileFoundCallback(req, res, fileReadStream)
            );
        };
    }

    getTestFileCallback() {
        return (req, res) => {
            const uri = `${(req.secure ? 'https://' : 'http://') +
                req.headers.host}/bundle/${req.params.file}`;
            const html = `<!doctype html>
                          <html>
                          <head><script type="text/javascript" src="${uri}"></script></head>
                          <body><p>Please open developer console</p></body>
                          </html>`;
            res.send(html);
        };
    }

    htmlErrorMessage(message) {
        return `<html><body><h1>${message}</h1></body></html>`;
    }

    statusErrors() {
        // eslint-disable-next-line no-unused-vars
        return (error, req, res, next) => {
            const status = error.output.payload.statusCode;
            const message = error.output.payload.error;
            const accepts = req.xhr
                ? 'json'
                : req.accepts(['html', 'json', 'text']);

            switch (accepts) {
                case 'json':
                    res.status(status).json(error.output.payload);
                    break;
                case 'html':
                    res.status(status).send(this.htmlErrorMessage(message));
                    break;
                case 'text':
                    res.status(status).send(message);
                    break;
                default:
                    res.status(406).send('Not Acceptable');
            }
        };
    }
};
