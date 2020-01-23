/* eslint-disable no-param-reassign */

'use strict';

const { hasher: contentHasher } = require('@asset-pipe/common');
const stringify = require('fast-json-stable-stringify');

module.exports = {
    hashContent(content) {
        if (typeof content !== 'string') {
            content = stringify(content);
        }
        return contentHasher(content);
    },
};
