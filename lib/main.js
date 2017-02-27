'use strict';

const express = require('express');
const SinkFs = require('asset-pipe-sink-fs');
const reader = require('asset-pipe-js-reader');
const body = require('body/json');
const boom = require('boom');

const params = require('./params');
const schemas = require('./schemas');


module.exports = class Router {
    constructor ({ sink, publicPath = './public/' } = {}) {
        this.sink = sink ? sink : new SinkFs(publicPath);

        this.app = express.Router(); // eslint-disable-line
        this.app.param('file', params.file);

        this.app.post('/feed', this.postFeedCallback());
        this.app.get('/feed/:file', this.getFileCallback());

        this.app.post('/bundle', this.postBundleParseCallback(),
                                 this.postBundleValidateCallback(),
                                 this.postBundlePersistCallback(),
                                 this.postBundleResponseCallback());
        this.app.get('/bundle/:file', this.getFileCallback());
    }


    router () {
        return this.app;
    }


    postFeedCallback () {
        return (req, res) => {
            let uri = `${(req.secure ? 'https://' : 'http://') + req.headers.host}/feed/`;

            const writer = this.sink.writer('json', (id, file) => {
                uri += file;
                res.status(200).json({
                    file,
                    uri,
                    id,
                });
            });

            return req.pipe(writer);
        };
    }


    postBundleParseCallback () {
        return (req, res, next) => {
            body(req, res, {}, (error, bodyObj) => {
                if (error) {
                    return next(boom.wrap(error, 400, 'Failed parsing postBundle POST-body'));
                }
                res.locals.bundle = bodyObj;
                next();
            });
        };
    }


    postBundleValidateCallback () {
        return (req, res, next) => {
            schemas.ids.validate(res.locals.bundle, (error, value) => {
                if (error) {
                    return next(boom.wrap(error, 400, 'Invalid POST-body'));
                }
                res.locals.bundle = value;
                next();
            });
        };
    }


    postBundlePersistCallback () {
        return (req, res, next) => {
            let uri = `${(req.secure ? 'https://' : 'http://') + req.headers.host}/bundle/`;

            res.locals.bundle.forEach((file, index, arr) => {
                arr[index] = this.sink.reader(file);
            });

            const writer = this.sink.writer('js', (id, file) => {
                uri += file;
                res.locals.response = {
                    file,
                    uri,
                    id,
                };
                next();
            });

            reader(res.locals.bundle).pipe(writer);
        };
    }


    postBundleResponseCallback () {
        return (req, res) => {
            res.status(200).json(res.locals.response);
        };
    }


    getFileCallback () {
        return (req, res) => this.sink.reader(req.params.file).pipe(res);
    }
};
