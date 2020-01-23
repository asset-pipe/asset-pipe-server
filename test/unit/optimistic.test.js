'use strict';

const Sink = require('@asset-pipe/sink-mem');
const OptimisticBundler = require('../../lib/optimistic-bundler');

beforeAll(() => jest.setTimeout(20000));

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

test('getFeeds()', async () => {
    const sink = new Sink();
    const ob = new OptimisticBundler({ sink });

    await sink.set('a.json', '1');
    await sink.set('b.json', '2');
    await sink.set('c.json', '3');
    await sink.set('/tags/js/a.txt', 'a');
    await sink.set('/tags/js/b.txt', 'b');
    await sink.set('/tags/js/c.txt', 'c');

    expect(await ob.getFeeds(['a', 'b', 'c'], 'js')).toEqual([1, 2, 3]);
});

test('bundle()', async () => {
    const sink = new Sink();
    const ob = new OptimisticBundler({ sink });

    await sink.set('hash1.json', JSON.stringify(feed1));
    await sink.set('hash2.json', JSON.stringify(feed2));
    await sink.set('hash3.json', JSON.stringify(feed3));
    await sink.set('/tags/js/a.txt', 'hash1');
    await sink.set('/tags/js/b.txt', 'hash2');
    await sink.set('/tags/js/c.txt', 'hash3');

    const buff = [];
    ob.metrics.on('data', chunk => {
        buff.push(chunk);
    });

    const bundle = await ob.bundle(
        'tag',
        ['a', 'b', 'c'],
        ['hash1', 'hash2', 'hash3'],
        'js',
    );
    expect(bundle).toMatchSnapshot();

    ob.metrics.destroy();

    expect(buff).toHaveLength(5);

    const obj = buff[0].toJSON();
    expect(obj.name).toEqual('asset_server_retrieve_from_storage_timer');
    expect(obj.description).toEqual(
        'Time taken for a retrieve operation from storage',
    );
    expect(obj.type).toEqual(5);
    expect(obj.meta).toEqual({ method: 'getFeed' });
});

test('bundleIfNeeded() - produces new bundle', async () => {
    const sink = new Sink();
    const ob = new OptimisticBundler({ sink });

    await sink.set('hash1.json', JSON.stringify(feed1));
    await sink.set('hash2.json', JSON.stringify(feed2));
    await sink.set('hash3.json', JSON.stringify(feed3));
    await sink.set('/tags/js/a.txt', 'hash1');
    await sink.set('/tags/js/b.txt', 'hash2');
    await sink.set('/tags/js/c.txt', 'hash3');

    await ob.bundleIfNeeded({ tag: 'tag', data: ['a', 'b', 'c'], type: 'js' });

    expect(
        await sink.get(
            'e867367ae217ade7ab1acf25afbb04cf3f3ad88cba5022e3c63a328db2124194.js',
        ),
    ).toMatchSnapshot();
});

test('bundleIfNeeded() - produces metrics', async () => {
    const sink = new Sink();
    const ob = new OptimisticBundler({ sink });

    await sink.set('hash1.json', JSON.stringify(feed1));
    await sink.set('hash2.json', JSON.stringify(feed2));
    await sink.set('hash3.json', JSON.stringify(feed3));
    await sink.set('/tags/js/a.txt', 'hash1');
    await sink.set('/tags/js/b.txt', 'hash2');
    await sink.set('/tags/js/c.txt', 'hash3');

    const buff = [];
    ob.metrics.on('data', chunk => {
        buff.push(chunk);
    });

    await ob.bundleIfNeeded({ tag: 'tag', data: ['a', 'b', 'c'], type: 'js' });

    ob.metrics.destroy();

    expect(buff).toHaveLength(8);
    const obj = buff[0].toJSON();
    expect(obj.name).toEqual('asset_server_retrieve_from_storage_timer');
    expect(obj.description).toEqual(
        'Time taken for a retrieve operation from storage',
    );
    expect(obj.type).toEqual(5);
    expect(obj.meta).toEqual({ method: 'getTags' });
});

test('bundleIfNeeded() - does not need to produce bundle', async () => {
    const sink = new Sink();
    const ob = new OptimisticBundler({ sink });

    await sink.set('hash1.json', JSON.stringify(feed1));
    await sink.set('hash2.json', JSON.stringify(feed2));
    await sink.set('hash3.json', JSON.stringify(feed3));
    await sink.set('/tags/js/a.txt', 'hash1');
    await sink.set('/tags/js/b.txt', 'hash2');
    await sink.set('/tags/js/c.txt', 'hash3');

    const file =
        'e867367ae217ade7ab1acf25afbb04cf3f3ad88cba5022e3c63a328db2124194.js';
    await sink.set(file, 'content was not replaced');
    await ob.bundleIfNeeded({ tag: 'tag', data: ['a', 'b', 'c'], type: 'js' });
    expect(
        await sink.get(
            'e867367ae217ade7ab1acf25afbb04cf3f3ad88cba5022e3c63a328db2124194.js',
        ),
    ).toBe('content was not replaced');
});

test('publishAssets() - invalid schema given', async () => {
    const sink = new Sink();
    const ob = new OptimisticBundler({ sink });
    expect(ob.publishAssets({}, 'js')).rejects.toMatchSnapshot();
});

test('publishInstructions() - invalid schema given', async () => {
    const sink = new Sink();
    const ob = new OptimisticBundler({ sink });
    expect(ob.publishInstructions({}, 'js')).rejects.toMatchSnapshot();
});
