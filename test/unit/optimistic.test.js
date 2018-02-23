'use strict';

const OptimisticBundler = require('../../lib/optimistic-bundler');
const Sink = require('@asset-pipe/sink-mem');
const { endWorkers } = require('../../lib/utils');

afterAll(() => endWorkers());

const feed1 = [
    {
        id: 'c645cf572a8f5acf8716e4846b408d3b1ca45c58',
        source: '"use strict";module.exports.world=function(){return"world"};',
        deps: {},
        file: './assets/js/bar.js',
    },
];

const feed2 = [
    {
        id: 'b645cf572a8f5acf8716e4846b408d3b1ca45c58',
        source: '"use strict";module.exports.world=function(){return"world"};',
        deps: {},
        file: './assets/js/foo.js',
    },
];

const feed3 = [
    {
        id: 'a645cf572a8f5acf8716e4846b408d3b1ca45c58',
        source: '"use strict";module.exports.world=function(){return"world"};',
        deps: {},
        file: './assets/js/baz.js',
    },
];

test('bundleExists() - doesnt exists', async () => {
    const sink = new Sink();
    const ob = new OptimisticBundler(sink);
    expect(await ob.bundleExists(['a', 'b', 'c'], 'js')).toBeFalsy();
});

test('bundleExists() - exists', async () => {
    const sink = new Sink();
    const ob = new OptimisticBundler(sink);
    const file =
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855.js';
    sink.db[file] = 'content';
    expect(await ob.bundleExists(['a', 'b', 'c'], 'js')).toBeTruthy();
});

test('getFeeds()', async () => {
    const sink = new Sink();
    const ob = new OptimisticBundler(sink);
    sink.db['a.json'] = '1';
    sink.db['b.json'] = '2';
    sink.db['c.json'] = '3';
    sink.db['meta/tags.json'] = JSON.stringify({
        'a/js': 'a',
        'b/js': 'b',
        'c/js': 'c',
    });
    expect(await ob.getFeeds(['a', 'b', 'c'], 'js')).toEqual([1, 2, 3]);
});

test('bundle()', async () => {
    const sink = new Sink();
    const ob = new OptimisticBundler(sink);

    sink.db['hash1.json'] = JSON.stringify(feed1);
    sink.db['hash2.json'] = JSON.stringify(feed2);
    sink.db['hash3.json'] = JSON.stringify(feed3);
    sink.db['meta/tags.json'] = JSON.stringify({
        'a/js': 'hash1',
        'b/js': 'hash2',
        'c/js': 'hash3',
    });

    const bundle = await ob.bundle(['a', 'b', 'c'], 'js');
    expect(bundle).toMatchSnapshot();
});

test('bundleIfNeeded() - produces new bundle', async () => {
    const sink = new Sink();
    const ob = new OptimisticBundler(sink);
    sink.db['hash1.json'] = JSON.stringify(feed1);
    sink.db['hash2.json'] = JSON.stringify(feed2);
    sink.db['hash3.json'] = JSON.stringify(feed3);
    sink.db['meta/tags.json'] = JSON.stringify({
        'a/js': 'hash1',
        'b/js': 'hash2',
        'c/js': 'hash3',
    });
    await ob.bundleIfNeeded(['a', 'b', 'c'], 'js');
    expect(sink).toMatchSnapshot();
});

test('bundleIfNeeded() - does not need to produce bundle', async () => {
    const sink = new Sink();
    const ob = new OptimisticBundler(sink);
    sink.db['a-hash1.json'] = JSON.stringify(feed1);
    sink.db['b-hash2.json'] = JSON.stringify(feed2);
    sink.db['c-hash3.json'] = JSON.stringify(feed3);
    sink.db['meta/tags.json'] = JSON.stringify({
        'a/js': 'hash1',
        'b/js': 'hash2',
        'c/js': 'hash3',
    });
    const file =
        'e867367ae217ade7ab1acf25afbb04cf3f3ad88cba5022e3c63a328db2124194.js';
    sink.db[file] = 'content was not replaced';
    await ob.bundleIfNeeded(['a', 'b', 'c'], 'js');
    expect(sink).toMatchSnapshot();
});
