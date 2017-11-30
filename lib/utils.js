'use strict';

const assert = require('assert');
const crypto = require('crypto');
const Boom = require('boom');
const bundleJS = require('@asset-pipe/js-reader');
const bundleCSS = require('@asset-pipe/css-reader');
const { promisify } = require('util');
const body = promisify(require('body/json'));
const schemas = require('./schemas');

function createHashFromContent(content) {
    const hasher = crypto.createHash('sha256');
    hasher.update(content, 'utf8');
    return hasher.digest('hex');
}

async function fetchFeeds(sink, ids) {
    try {
        return await Promise.all(ids.map(file => sink.get(file)));
    } catch (err) {
        throw Boom.boomify(err, {
            statusCode: err.message.includes('No file with name') ? 404 : 500,
            message: 'Unable to fetch 1 or more feeds from storage.',
        });
    }
}

function parseFeeds(rawFeeds) {
    try {
        return rawFeeds.map(JSON.parse);
    } catch (err) {
        throw Boom.boomify(err, {
            message: 'Unable to parse 1 or more feeds as JSON.',
        });
    }
}

async function bundleFeeds(feeds, type) {
    if (type === 'css') {
        try {
            return await bundleCSS(feeds);
        } catch (err) {
            throw Boom.boomify(err, {
                message: 'Unable to bundle feeds as CSS.',
            });
        }
    } else {
        try {
            return await bundleJS(feeds);
        } catch (err) {
            throw Boom.boomify(err, {
                message: 'Unable to bundle feeds as JS.',
            });
        }
    }
}

async function upload(sink, fileName, content) {
    try {
        await sink.set(fileName, content);
    } catch (err) {
        throw Boom.boomify(err, {
            message: `Unable to upload bundle with fileName "${fileName}" to storage.`,
        });
    }
}

async function bundleAndUpload({ sink, type, feedIds, uri }) {
    assert(
        Array.isArray(feedIds) && feedIds.length > 0,
        `Expected at least 1 feed id, but got ${feedIds}`
    );

    const fetchedFeeds = await fetchFeeds(sink, feedIds);
    const parsedFeeds = parseFeeds(fetchedFeeds);
    const content = await bundleFeeds(parsedFeeds, type);
    const fileName = `${createHashFromContent(content)}.${type}`;
    await upload(sink, fileName, content);

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
            message: 'No feed data given in POST-body.',
        });
    }
}

function validateFeeds(feeds) {
    try {
        const result = schemas.ids.validate(feeds);
        if (result.error) {
            throw result.error;
        }
        return result.value;
    } catch (e) {
        throw Boom.boomify(e, {
            statusCode: 400,
            message: 'Invalid feed data given in POST-body.',
        });
    }
}

module.exports = {
    createHashFromContent,
    fetchFeeds,
    parseFeeds,
    bundleFeeds,
    upload,
    bundleAndUpload,
    parseBody,
    validateFeeds,
};
