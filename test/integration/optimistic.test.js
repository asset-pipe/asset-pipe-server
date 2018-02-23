'use strict';

const publishAssets = require('../../lib/publish-assets');
const publishInstructions = require('../../lib/publish-instructions');
const Sink = require('@asset-pipe/sink-mem');
const express = require('express');
const supertest = require('supertest');
const Router = require('../../lib/main');
const { endWorkers } = require('../../lib/utils');
const Hasher = require('../../lib/hasher');

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

    await publishAssets(sink, {
        tag: 'podlet1',
        type: 'js',
        data: feed1,
    });

    await publishInstructions(sink, {
        tag: 'layout1',
        type: 'js',
        data: ['podlet1'],
    });

    expect(sink.db).toMatchSnapshot();
});

test('publish instructions before publishing assets', async () => {
    const sink = new Sink();

    await publishInstructions(sink, {
        tag: 'layout1',
        type: 'js',
        data: ['podlet1'],
    });

    await publishAssets(sink, {
        tag: 'podlet1',
        type: 'js',
        data: feed1,
    });

    expect(sink.db).toMatchSnapshot();
});

test('optimistic bundling of css feeds', async () => {
    const sink = new Sink();

    await publishAssets(sink, {
        tag: 'podlet1',
        type: 'css',
        data: cssFeed1,
    });

    await publishInstructions(sink, {
        tag: 'layout1',
        type: 'css',
        data: ['podlet1'],
    });

    expect(sink.db).toMatchSnapshot();
});

test('publish instructions before publishing muiltple assets', async () => {
    const sink = new Sink();

    await publishInstructions(sink, {
        tag: 'layout1',
        type: 'js',
        data: ['podlet1', 'podlet2', 'podlet3'],
    });

    await publishAssets(sink, {
        tag: 'podlet1',
        type: 'js',
        data: feed1,
    });

    await publishAssets(sink, {
        tag: 'podlet2',
        type: 'js',
        data: feed2,
    });

    await publishAssets(sink, {
        tag: 'podlet3',
        type: 'js',
        data: feed3,
    });

    expect(sink.db).toMatchSnapshot();
});

test('publish instructions updated', async () => {
    const sink = new Sink();

    await publishAssets(sink, {
        tag: 'podlet1',
        type: 'js',
        data: feed1,
    });

    await publishAssets(sink, {
        tag: 'podlet2',
        type: 'js',
        data: feed2,
    });

    await publishAssets(sink, {
        tag: 'podlet3',
        type: 'js',
        data: feed3,
    });

    await publishInstructions(sink, {
        tag: 'layout1',
        type: 'js',
        data: ['podlet1', 'podlet2', 'podlet3'],
    });

    expect(sink.db).toMatchSnapshot();

    await publishInstructions(sink, {
        tag: 'layout1',
        type: 'js',
        data: ['podlet1', 'podlet2'],
    });

    expect(sink.db).toMatchSnapshot();

    await publishInstructions(sink, {
        tag: 'layout1',
        type: 'js',
        data: ['podlet1'],
    });

    expect(sink.db).toMatchSnapshot();
});

test('republishing same asset does not trigger a rebuild', async () => {
    const sink = new Sink();

    await publishAssets(sink, {
        tag: 'podlet1',
        type: 'js',
        data: feed1,
    });

    await publishAssets(sink, {
        tag: 'podlet2',
        type: 'js',
        data: feed2,
    });

    await publishAssets(sink, {
        tag: 'podlet3',
        type: 'js',
        data: feed3,
    });

    await publishInstructions(sink, {
        tag: 'layout1',
        type: 'js',
        data: ['podlet1', 'podlet2', 'podlet3'],
    });

    await publishAssets(sink, {
        tag: 'podlet2',
        type: 'js',
        data: feed2,
    });

    expect(sink.db).toMatchSnapshot();
});

test('republishing different asset triggers a rebuild', async () => {
    const sink = new Sink();

    await publishAssets(sink, {
        tag: 'podlet1',
        type: 'js',
        data: feed1,
    });

    await publishAssets(sink, {
        tag: 'podlet2',
        type: 'js',
        data: feed2,
    });

    await publishAssets(sink, {
        tag: 'podlet3',
        type: 'js',
        data: feed3,
    });

    await publishInstructions(sink, {
        tag: 'layout1',
        type: 'js',
        data: ['podlet1', 'podlet2', 'podlet3'],
    });

    expect(sink.db).toMatchSnapshot();

    await publishAssets(sink, {
        tag: 'podlet2',
        type: 'js',
        data: feed4,
    });

    expect(sink.db).toMatchSnapshot();
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
    expect.assertions(1);
    const router = new Router();
    const { server } = await createTestServerFor(router.router());
    const post = supertest(server).post;
    await post('/publish-assets').send({
        tag: 'podlet1',
        type: 'js',
        data: feed1,
    });
    const { body } = await post('/publish-instructions')
        .send({ tag: 'layout1', type: 'js', data: ['podlet1'] })
        .expect(200);

    expect(body.success).toBe(true);
    return server.close();
});

test('calculating asset filename', async () => {
    const sink = new Sink();

    const hash = await Hasher.hashArray([
        Hasher.hashContent(feed1),
        Hasher.hashContent(feed2),
        Hasher.hashContent(feed3),
    ]);

    await publishInstructions(sink, {
        tag: 'layout1',
        type: 'js',
        data: ['podlet1', 'podlet2', 'podlet3'],
    });

    await publishAssets(sink, {
        tag: 'podlet1',
        type: 'js',
        data: feed1,
    });

    await publishAssets(sink, {
        tag: 'podlet2',
        type: 'js',
        data: feed2,
    });

    await publishAssets(sink, {
        tag: 'podlet3',
        type: 'js',
        data: feed3,
    });

    expect(sink.db[`${hash}.js`]).toBeTruthy();
});
