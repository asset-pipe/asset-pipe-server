'use strict';

const OptimisticBundler = require('./optimistic-bundler');

module.exports = async (sink, instruction) => {
    const ob = new OptimisticBundler(sink);
    return ob.publishInstructions(instruction);
};
