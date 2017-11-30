'use strict';

const assert = require('assert');
const Boom = require('boom');
const bundleJS = require('@asset-pipe/js-reader');
const bundleCSS = require('@asset-pipe/css-reader');
const { promisify } = require('util');
const body = promisify(require('body/json'));
const schemas = require('./schemas');
const parseJson = require('parse-json');
const pretry = require('p-retry');
const { hasher } = require('asset-pipe-common');

async function fetchFeeds(sink, ids, retries = 0) {
    const run = file => async () => {
        try {
            return await sink.get(file);
        } catch (err) {
            if (err.message.includes('No file with name')) {
                throw new pretry.AbortError(`File "${file}" not found.`);
            }
            throw err;
        }
    };

    try {
        return await Promise.all(
            ids.map(file => pretry(run(file), { retries }))
        );
    } catch (err) {
        throw Boom.boomify(err, {
            statusCode: /File ".*json" not found/.test(err.message) ? 404 : 500,
            message: 'Unable to fetch 1 or more feeds from storage.',
        });
    }
}

function parseFeeds(rawFeeds) {
    try {
        return rawFeeds.map(parseJson);
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

async function upload(sink, fileName, content, retries = 0) {
    try {
        await pretry(() => sink.set(fileName, content), { retries });
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

    const fetchedFeeds = await fetchFeeds(sink, feedIds, 3);
    const parsedFeeds = parseFeeds(fetchedFeeds);
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

module.exports = {
    fetchFeeds,
    parseFeeds,
    bundleFeeds,
    upload,
    bundleAndUpload,
    parseBody,
    validateFeeds,
};
