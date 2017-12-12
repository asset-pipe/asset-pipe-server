'use strict';

const assert = require('assert');
const Boom = require('boom');
const { promisify } = require('util');
const body = promisify(require('body/json'));
const schemas = require('./schemas');
const parseJson = require('parse-json');
const { hasher } = require('asset-pipe-common');
const { default: Worker } = require('jest-worker');

const bundleWorker = new Worker(require.resolve('./bundler'));

async function fetchFeeds(sink, ids) {
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

function parseFeedContent(feeds) {
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

async function bundleFeeds(feeds, type) {
    if (type === 'css') {
        try {
            return await bundleWorker.bundeCSS(feeds);
        } catch (err) {
            throw Boom.boomify(err, {
                message: 'Unable to bundle feeds as CSS.',
            });
        }
    } else {
        try {
            return await bundleWorker.bundeJS(feeds);
        } catch (err) {
            throw Boom.boomify(err, {
                message: 'Unable to bundle feeds as JS.',
            });
        }
    }
}

async function upload(sink, fileName, content) {
    try {
        return await sink.set(fileName, content);
    } catch (err) {
        throw Boom.boomify(err, {
            message: `Unable to upload file with name "${fileName}".`,
        });
    }
}

async function bundleAndUpload({ sink, type, feedIds, uri }) {
    assert(
        Array.isArray(feedIds) && feedIds.length > 0,
        `Expected at least 1 feed id, but got ${feedIds}`
    );

    const fetchedFeeds = await fetchFeeds(sink, feedIds, 3);
    const parsedFeeds = parseFeedContent(fetchedFeeds);
    const content = await bundleFeeds(parsedFeeds, type);
    const fileName = `${hasher(content)}.${type}`;
    await upload(sink, fileName, content, 3);

    return {
        file: fileName,
        uri: uri + fileName,
    };
}

async function parseBody(req, res) {
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

function validateFeeds(feeds) {
    const result = schemas.ids.validate(feeds);
    if (result.error) {
        throw Boom.boomify(result.error, {
            statusCode: 400,
            message: 'Invalid feed data given in POST-body.',
        });
    }
    return result.value;
}

function endWorkers() {
    bundleWorker.end();
}

module.exports = {
    endWorkers,
    fetchFeeds,
    parseFeedContent,
    bundleFeeds,
    upload,
    bundleAndUpload,
    parseBody,
    validateFeeds,
};
