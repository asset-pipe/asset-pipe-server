'use strict';

const OptimisticBundler = require('./optimistic-bundler');

module.exports = async function publishAssets(sink, feed) {
    const ob = new OptimisticBundler({ sink });
    return ob.publishAssets(feed);
};
