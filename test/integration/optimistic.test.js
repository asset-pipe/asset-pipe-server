'use strict';

const Sink = require('@asset-pipe/sink-mem');
const express = require('express');
const supertest = require('supertest');
const Router = require('../../lib/main');
const { endWorkers } = require('../../lib/utils');
const Hasher = require('../../lib/hasher');
const OptimisticBundler = require('../../lib/optimistic-bundler');

beforeAll(() => jest.setTimeout(20000));
afterAll(() => endWorkers());

function createTestServerFor(router) {
    const app = express();
    app.use(router);
    return new Promise(resolve => {
        const server = app.listen(() => {
            resolve({
                server,
                port: server.address().port,
            });
        });
    });
}

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

const feed4 = [
    {
        id: 'e645cf572a8f5acf8716e4846b408d3b1ca45c58',
        source: '"use strict";module.exports.world=function(){return"world"};',
        deps: {},
        file: './assets/js/foobar.js',
    },
];

const cssFeed1 = [
    {
        id: 'c645cf572a8f5acf8716e4846b408d3b1ca45c58',
        source: 'h1 { color: red; }',
        deps: {},
        file: './assets/css/bar.js',
    },
];

test('optimistic bundling of js feeds', async () => {
    const sink = new Sink();
    const optimisticBundler = new OptimisticBundler({ sink });

    await optimisticBundler.publishAssets({
        tag: 'podlet1',
        type: 'js',
        data: feed1,
    });
    await optimisticBundler.publishInstructions({
        tag: 'layout1',
        type: 'js',
        data: ['podlet1'],
    });

    expect(
        await sink.get(
            '8b9a3142fa84751f4a0b6578f58024bd3b98aea6fb47f8e87dd0c813a250fa95.js'
        )
    ).toMatchSnapshot();
});

test('publish instructions before publishing assets', async () => {
    const sink = new Sink();
    const optimisticBundler = new OptimisticBundler({ sink });

    await optimisticBundler.publishInstructions({
        tag: 'layout1',
        type: 'js',
        data: ['podlet1'],
    });

    await optimisticBundler.publishAssets({
        tag: 'podlet1',
        type: 'js',
        data: feed1,
    });

    expect(
        await sink.get(
            '8b9a3142fa84751f4a0b6578f58024bd3b98aea6fb47f8e87dd0c813a250fa95.js'
        )
    ).toMatchSnapshot();
});

test('optimistic bundling of css feeds', async () => {
    const sink = new Sink();
    const optimisticBundler = new OptimisticBundler({ sink });

    await optimisticBundler.publishAssets({
        tag: 'podlet1',
        type: 'css',
        data: cssFeed1,
    });

    await optimisticBundler.publishInstructions({
        tag: 'layout1',
        type: 'css',
        data: ['podlet1'],
    });

    expect(
        await sink.get(
            '2c408796d55d03d6fbaef774c591b868cf07cac4147bc61d3b40825e16f725ab.css'
        )
    ).toMatchSnapshot();
});

test('publish instructions before publishing muiltple assets', async () => {
    const sink = new Sink();
    const optimisticBundler = new OptimisticBundler({ sink });

    await optimisticBundler.publishInstructions({
        tag: 'layout1',
        type: 'js',
        data: ['podlet1', 'podlet2', 'podlet3'],
    });

    await optimisticBundler.publishAssets({
        tag: 'podlet1',
        type: 'js',
        data: feed1,
    });

    await optimisticBundler.publishAssets({
        tag: 'podlet2',
        type: 'js',
        data: feed2,
    });

    await optimisticBundler.publishAssets({
        tag: 'podlet3',
        type: 'js',
        data: feed3,
    });

    expect(
        await sink.get(
            '81840961ff9dff9c99dc7f3e04a829a90a3169b31e38f452f9c4ea04bc6436d3.js'
        )
    ).toMatchSnapshot();
});

test('publish instructions updated', async () => {
    const sink = new Sink();
    const optimisticBundler = new OptimisticBundler({ sink });

    await optimisticBundler.publishAssets({
        tag: 'podlet1',
        type: 'js',
        data: feed1,
    });

    await optimisticBundler.publishAssets({
        tag: 'podlet2',
        type: 'js',
        data: feed2,
    });

    await optimisticBundler.publishAssets({
        tag: 'podlet3',
        type: 'js',
        data: feed3,
    });

    await optimisticBundler.publishInstructions({
        tag: 'layout1',
        type: 'js',
        data: ['podlet1', 'podlet2', 'podlet3'],
    });

    expect(sink.db).toMatchSnapshot();

    await optimisticBundler.publishInstructions({
        tag: 'layout1',
        type: 'js',
        data: ['podlet1', 'podlet2'],
    });

    expect(sink.db).toMatchSnapshot();

    await optimisticBundler.publishInstructions({
        tag: 'layout1',
        type: 'js',
        data: ['podlet1'],
    });

    expect(
        await sink.get(
            '81840961ff9dff9c99dc7f3e04a829a90a3169b31e38f452f9c4ea04bc6436d3.js'
        )
    ).toMatchSnapshot();
});

test('republishing same asset does not trigger a rebuild', async () => {
    const sink = new Sink();
    const optimisticBundler = new OptimisticBundler({ sink });

    await optimisticBundler.publishAssets({
        tag: 'podlet1',
        type: 'js',
        data: feed1,
    });

    await optimisticBundler.publishAssets({
        tag: 'podlet2',
        type: 'js',
        data: feed2,
    });

    await optimisticBundler.publishAssets({
        tag: 'podlet3',
        type: 'js',
        data: feed3,
    });

    await optimisticBundler.publishInstructions({
        tag: 'layout1',
        type: 'js',
        data: ['podlet1', 'podlet2', 'podlet3'],
    });

    await optimisticBundler.publishAssets({
        tag: 'podlet2',
        type: 'js',
        data: feed2,
    });

    expect(
        await sink.get(
            '81840961ff9dff9c99dc7f3e04a829a90a3169b31e38f452f9c4ea04bc6436d3.js'
        )
    ).toMatchSnapshot();
});

test('republishing different asset triggers a rebuild', async () => {
    const sink = new Sink();
    const optimisticBundler = new OptimisticBundler({ sink });

    await optimisticBundler.publishAssets({
        tag: 'podlet1',
        type: 'js',
        data: feed1,
    });

    await optimisticBundler.publishAssets({
        tag: 'podlet2',
        type: 'js',
        data: feed2,
    });

    await optimisticBundler.publishAssets({
        tag: 'podlet3',
        type: 'js',
        data: feed3,
    });

    await optimisticBundler.publishInstructions({
        tag: 'layout1',
        type: 'js',
        data: ['podlet1', 'podlet2', 'podlet3'],
    });

    expect(
        await sink.get(
            '81840961ff9dff9c99dc7f3e04a829a90a3169b31e38f452f9c4ea04bc6436d3.js'
        )
    ).toMatchSnapshot();

    await optimisticBundler.publishAssets({
        tag: 'podlet2',
        type: 'js',
        data: feed4,
    });

    expect(
        await sink.get(
            '19f3f812f476bade25e76694c8ea4e96280c1a9f7cda77a813c301b9ef8612c6.js'
        )
    ).toMatchSnapshot();
});

test('publishing a feed via the /publish-assets endpoint', async () => {
    expect.assertions(1);
    const router = new Router();
    const { server } = await createTestServerFor(router.router());
    const post = supertest(server).post;
    const payload = {
        tag: 'podlet1',
        type: 'js',
        data: feed1,
    };
    const { body } = await post('/publish-assets')
        .send(payload)
        .expect(200);
    expect(body).toMatchSnapshot();
    return server.close();
});

test('publishing bundling instructions via the /publish-instructions endpoint', async () => {
    const router = new Router();
    const { server } = await createTestServerFor(router.router());
    const post = supertest(server).post;
    await post('/publish-assets').send({
        tag: 'podlet1',
        type: 'js',
        data: feed1,
    });
    await post('/publish-instructions')
        .send({ tag: 'layout1', type: 'js', data: ['podlet1'] })
        .expect(204);

    return server.close();
});

test('calculating asset filename', async () => {
    const sink = new Sink();
    const optimisticBundler = new OptimisticBundler({ sink });

    const hash = await Hasher.hashArray([
        Hasher.hashContent(feed1),
        Hasher.hashContent(feed2),
        Hasher.hashContent(feed3),
    ]);

    await optimisticBundler.publishInstructions({
        tag: 'layout1',
        type: 'js',
        data: ['podlet1', 'podlet2', 'podlet3'],
    });

    await optimisticBundler.publishAssets({
        tag: 'podlet1',
        type: 'js',
        data: feed1,
    });

    await optimisticBundler.publishAssets({
        tag: 'podlet2',
        type: 'js',
        data: feed2,
    });

    await optimisticBundler.publishAssets({
        tag: 'podlet3',
        type: 'js',
        data: feed3,
    });

    expect(await sink.get(`${hash}.js`)).toBeTruthy();
});
