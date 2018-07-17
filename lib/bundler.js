'use strict';

const assert = require('assert');
const Boom = require('boom');
const { promisify } = require('util');
const body = promisify(require('body/json'));
const schemas = require('./schemas');
const parseJson = require('parse-json');
const { hasher } = require('@asset-pipe/common');
const { default: Worker } = require('jest-worker');

module.exports = class Bundler {
    constructor({ bundleInProcess = false } = {}) {
        this.bundleInProcess = bundleInProcess;

        if (bundleInProcess) {
            this.bundler = require('./bundler-utils');
        } else {
            this.bundler = new Worker(require.resolve('./bundler-utils'), {
                numWorkers: 2,
            });
        }
    }

    async fetchFeeds(sink, ids) {
        try {
            return await Promise.all(
                ids.map(async fileName => ({
                    fileName,
                    contents: await sink.get(fileName),
                }))
            );
        } catch (err) {
            throw Boom.boomify(err, {
                message: 'Unable to fetch 1 or more feeds.',
            });
        }
    }

    parseFeedContent(feeds) {
        const result = [];
        for (const { fileName, contents } of feeds) {
            try {
                result.push(parseJson(contents));
            } catch (err) {
                throw Boom.boomify(err, {
                    message: `Unable to parse 1 or more feeds as JSON. File ${fileName} was unparseable.`,
                });
            }
        }
        return result;
    }

    async bundleFeeds(feeds, type, options) {
        if (type === 'css') {
            try {
                return await this.bundler.bundleCSS(feeds);
            } catch (err) {
                throw Boom.boomify(err, {
                    message: 'Unable to bundle feeds as CSS.',
                });
            }
        } else {
            try {
                return await this.bundler.bundleJS(feeds, options);
            } catch (err) {
                throw Boom.boomify(err, {
                    message: 'Unable to bundle feeds as JS.',
                });
            }
        }
    }

    async upload(sink, fileName, content) {
        try {
            return await sink.set(fileName, content);
        } catch (err) {
            throw Boom.boomify(err, {
                message: `Unable to upload file with name "${fileName}".`,
            });
        }
    }

    async bundleAndUpload({ sink, type, feedIds, uri, ...options }) {
        assert(
            Array.isArray(feedIds) && feedIds.length > 0,
            `Expected at least 1 feed id, but got ${feedIds}`
        );

        const fetchedFeeds = await this.fetchFeeds(sink, feedIds, 3);
        const parsedFeeds = this.parseFeedContent(fetchedFeeds);
        const content = await this.bundleFeeds(parsedFeeds, type, options);
        const fileName = `${hasher(content)}.${type}`;
        await this.upload(sink, fileName, content, 3);

        return {
            file: fileName,
            uri: uri + fileName,
        };
    }

    async parseBody(req, res) {
        try {
            return await body(req, res, {});
        } catch (e) {
            throw Boom.boomify(e, {
                statusCode: 400,
                message:
                    'Unparsable feed data given in POST-body. Invalid or empty JSON payload.',
            });
        }
    }

    validateFeeds(feeds) {
        const result = schemas.ids.validate(feeds);
        if (result.error) {
            throw Boom.boomify(result.error, {
                statusCode: 400,
                message: 'Invalid feed data given in POST-body.',
            });
        }
        return result.value;
    }

    async endWorkers() {
        if (this.bundleInProcess) {
            return;
        }

        await this.bundler.end();
    }
};
