'use strict';

const OptimisticBundler = require('./optimistic-bundler');

module.exports = async (sink, instruction, options) => {
    const ob = new OptimisticBundler(sink, options);
    return ob.publishInstructions(instruction);
};
