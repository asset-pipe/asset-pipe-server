'use strict';

const EventEmitter = require('events');
const express = require('express');
const SinkMem = require('@asset-pipe/sink-mem');
const Boom = require('boom');
const uuid = require('uuid/v4');
const mime = require('mime-types');
const { Transform } = require('readable-stream');
const params = require('./params');
const MetaStorage = require('./meta-storage');
const Metrics = require('@podium/metrics');
const {
    parseBody,
    validateFeeds,
    bundleAndUpload,
    endWorkers,
    booleanWithDefault,
} = require('./utils');
const OptimisticBundler = require('../lib/optimistic-bundler');

const DEFAULT_NODE_ENV = 'development';

/*
    TODO:
    This function exists due to larger payloads causing the body module some grief.
    the util.parseBody function does essentially the same thing so there shouldn't be a
    need for both.

    However in the short term I don't want to replace util.parseBody as it is used
    in non optimistic bundling which I would rather leave completely untouched (for fear of bugs sneaking in)
    and then phase it out along with all non optimistic bundling endpoints (after first deprecating).
 */
async function getBody(req) {
    const data = [];
    return new Promise((resolve, reject) => {
        req.once('error', reject);
        req.on('data', chunk => data.push(chunk.toString()));
        req.once('end', () => {
            try {
                const payload = JSON.parse(data.join(''));
                resolve(payload);
            } catch (err) {
                reject(
                    Boom.boomify(err, {
                        statusCode: 400,
                        message:
                            'Unparsable feed data given in POST-body. Invalid or empty JSON payload.',
                    })
                );
            }
        });
    });
}

/*
    TODO:
    This function is being used as a bridge between 'emit' style logging and 'abstract logger' style logging allowing
    the new OptimisticBundler class to use abslog while continuing to emit logs from the router.

    The plan should eventually be to phase this out in favour of the abstract logger pattern everywhere.
*/
function emitLogger(context) {
    return {
        trace() {},
        debug(...args) {
            context.emit('debug', args.join(' '));
        },
        info(...args) {
            context.emit('info', args.join(' '));
        },
        warn() {},
        error() {},
        fatal() {},
    };
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
            const message =
                'Expected payload provided to `/feed` to be an array ' +
                `of feed objects but instead payload was unparseable. Got "${buffered}".`;

            return cb(Boom.boomify(err, { statusCode: 400, message }));
        }
        if (json.length) {
            for (const chunk of this.chunks) {
                this.push(chunk);
            }
            cb();
        } else {
            const msg =
                'Expected payload provided to `/feed` to be an array ' +
                `of feed objects but instead got "${buffered}".`;
            cb(Boom.badRequest(msg));
        }
    }
}

module.exports = class Router extends EventEmitter {
    constructor(sink, options = {}) {
        super();

        const { NODE_ENV } = process.env;
        this.options = {
            logger: emitLogger(this),
            env: NODE_ENV || DEFAULT_NODE_ENV,
            publicAssetUrl: null,
            ...options,
        };
        this.options.isProduction = this.options.env === 'production';

        this.sink = sink ? sink : new SinkMem();
        this.metaStorage = new MetaStorage(this.sink);
        this.metrics = new Metrics();

        this.bundler = new OptimisticBundler({
            env: this.options.env,
            sink: this.sink,
            logger: this.options.logger,
        });

        this.bundler.metrics.pipe(this.metrics);

        this.app = express.Router(); // eslint-disable-line new-cap

        this.app.use((req, res, next) => {
            res.locals.track = uuid();
            this.emit('request start', res.locals.track, req.method, req.path);
            next();
        });

        this.app.param('file', params.file);
        this.app.param('type', params.type);

        this.app.post(
            '/feed/:type/:id?',
            this.postFeedPersistCallback(),
            this.postFeedResponseCallback()
        );

        this.app.get('/feed/:file', this.getFileCallback());

        this.app.post('/bundle/:type/:id?', this.postBundleHandler());

        this.app.get('/bundle/:file', this.getFileCallback());
        this.app.get('/test/bundle/:file', this.getTestFileCallback());

        this.app.post('/publish-assets', async (req, res, next) => {
            try {
                const payload = await getBody(req);
                const meta = await this.bundler.publishAssets(payload, {
                    minify: booleanWithDefault(
                        req.query.minify,
                        this.options.isProduction
                    ),
                    sourceMaps: booleanWithDefault(req.query.sourceMaps, false),
                    rebundle: booleanWithDefault(req.query.rebundle, true),
                });
                res.send(meta);
            } catch (err) {
                next(err);
            }
        });

        this.app.get('/sync', (req, res) => {
            const data = {
                publicBundleUrl:
                    this.options.publicAssetUrl ||
                    this.buildUri('bundle', req.headers.host, req.secure),
                publicFeedUrl:
                    this.options.publicAssetUrl ||
                    this.buildUri('feed', req.headers.host, req.secure),
            };

            this.options.logger.info(
                `sync requested by client, sending data ${JSON.stringify(data)}`
            );

            res.json(data);
        });

        this.app.post('/publish-instructions', async (req, res, next) => {
            try {
                const payload = await parseBody(req, res);
                await this.bundler.publishInstructions(payload, {
                    minify: booleanWithDefault(
                        req.query.minify,
                        this.options.isProduction
                    ),
                    sourceMaps: booleanWithDefault(req.query.sourceMaps, false),
                });
                res.sendStatus(204);
            } catch (err) {
                next(err);
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

        this.app.use([
            (err, req, res, next) => {
                // istanbul ignore else: this catch is just a precaution and we are unsure if it can even happen.
                if (Boom.isBoom(err)) {
                    next(err);
                } else if (err.isJoi) {
                    next(Boom.boomify(err, { statusCode: 400 }));
                } else {
                    next(Boom.boomify(err));
                }
            },
            this.statusErrors(),
        ]);
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
        return async (req, res, next) => {
            const { id, type } = req.params;

            if (id) {
                const filename = `${type}/${id}`;

                try {
                    await this.metaStorage.set(filename, {
                        id,
                        version: res.locals.response.file,
                    });
                } catch (e) {
                    return next(e);
                }
            }

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

    postBundleHandler() {
        return async (req, res, next) => {
            const { id, type } = req.params;
            const sourceMaps = req.query.sourceMaps === 'true';
            const minify =
                req.query.minify === 'true' || this.options.isProduction;

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
                    sourceMaps,
                    minify,
                    env: this.options.env,
                });
                this.emit(
                    'info',
                    `Requested asset bundle produced and successfully uploaded.`
                );

                if (id) {
                    const filename = `${type}/${id}`;

                    await this.metaStorage.set(filename, {
                        id,
                        version: response.file,
                    });
                }

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
            const file = req.params.file;
            try {
                const fileReadStream = this.sink.reader(file);
                fileReadStream.on('error', next);
                fileReadStream.on('file not found', this.onFileNotFound(next));
                fileReadStream.on('file found', () =>
                    this.fileFoundCallback(req, res, fileReadStream)
                );
            } catch (err) {
                next(
                    Boom.boomify(err, {
                        message: `Attempting to read the file (${file}) caused an unknown error. This likely means that the underlying stream mechanism failed in an unexpected way when trying to read the file and this could not be handled.`,
                    })
                );
            }
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

    /* istanbul ignore next: invoking this method in the test has repercussions */
    async cleanup() {
        endWorkers();
    }
};
