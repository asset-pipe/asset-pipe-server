'use strict';

const EventEmitter = require('events');
const express = require('express');
const SinkMem = require('@asset-pipe/sink-mem');
const bundleJS = require('@asset-pipe/js-reader');
const bundleCSS = require('@asset-pipe/css-reader');
const boom = require('boom');
const uuid = require('uuid/v4');
const mime = require('mime-types');
const { Transform } = require('readable-stream');
const { promisify } = require('util');
const body = promisify(require('body/json'));

const params = require('./params');
const schemas = require('./schemas');

const crypto = require('crypto');
const assert = require('assert');

function createHashFromContent(content) {
    const hasher = crypto.createHash('sha256');
    hasher.update(content, 'utf8');
    return hasher.digest('hex');
}

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
            return cb(boom.badRequest(msg));
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
            cb(boom.badRequest(msg));
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
            let feedIds;
            try {
                const payload = await body(req, res, {});
                const result = schemas.ids.validate(payload);
                if (result.error) {
                    throw result.error;
                }
                feedIds = result.value;
            } catch (e) {
                return next(
                    boom.boomify(e, {
                        statusCode: 400,
                        message: 'Invalid POST-body',
                    })
                );
            }

            try {
                const response = await this.bundle({
                    feedIds,
                    uri: this.buildUri('bundle', req.headers.host, req.secure),
                    type,
                });
                this.emit(
                    'request success',
                    res.locals.track,
                    req.method,
                    req.path,
                    response.file
                );
                res.json(response);
            } catch (e) {
                if (e.message.includes('No file with name')) {
                    return next(
                        boom.boomify(e, {
                            statusCode: 409,
                        })
                    );
                }
                next(e);
            }
        };
    }

    async bundle({ type, feedIds, uri }) {
        assert(
            Array.isArray(feedIds) && feedIds.length > 0,
            `Expected at least 1 feed id, but got ${feedIds}`
        );
        this.emit('info', `Processing feeds ${feedIds.join(', ')}`);
        const feeds = await Promise.all(
            feedIds.map(file =>
                this.sink
                    .get(file)
                    .then(JSON.parse)
                    .then(feed => {
                        assert(
                            Array.isArray(feed),
                            `Expected feed entry to be an array, but got ${typeof feed}`
                        );
                        return feed;
                    })
            )
        );

        let bundle;
        if (type === 'css') {
            bundle = await bundleCSS(feeds);
        } else {
            bundle = await bundleJS(feeds);
        }

        const fileName = `${createHashFromContent(bundle)}.${type}`;

        await this.sink.set(fileName, bundle);
        this.emit('info', `Saved "${fileName}"`);

        return {
            file: fileName,
            uri: uri + fileName,
        };
    }

    onError(next, message) {
        return error => {
            next(boom.boomify(error, { statusCode: 400, message }));
        };
    }

    onFileNotFound(next) {
        return () => {
            next(boom.notFound());
        };
    }

    onPipelineEmpty(next) {
        return () => {
            next(
                boom.badRequest(
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
