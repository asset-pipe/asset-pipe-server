'use strict';

const publishAssets = require('../lib/publish-assets');
const publishInstructions = require('../lib/publish-instructions');
const Sink = require('@asset-pipe/sink-mem');
const express = require('express');
const supertest = require('supertest');
const Router = require('../lib/main');
const { endWorkers } = require('../lib/utils');

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

test('integration - optimistic bundling of js feeds', async () => {
    const sink = new Sink();

    await publishAssets(sink, {
        tag: 'podlet1',
        type: 'js',
        data: [
            {
                id: 'c645cf572a8f5acf8716e4846b408d3b1ca45c58',
                source:
                    '"use strict";module.exports.world=function(){return"world"};',
                deps: {},
                file: './assets/js/bar.js',
            },
        ],
    });

    await publishInstructions(sink, {
        tag: 'layout1',
        type: 'js',
        data: ['podlet1'],
    });

    expect(sink.db).toMatchSnapshot();
});

test('integration - publish instructions before publishing assets', async () => {
    const sink = new Sink();

    await publishInstructions(sink, {
        tag: 'layout1',
        type: 'js',
        data: ['podlet1'],
    });

    await publishAssets(sink, {
        tag: 'podlet1',
        type: 'js',
        data: [
            {
                id: 'c645cf572a8f5acf8716e4846b408d3b1ca45c58',
                source:
                    '"use strict";module.exports.world=function(){return"world"};',
                deps: {},
                file: './assets/js/bar.js',
            },
        ],
    });

    expect(sink.db).toMatchSnapshot();
});

test('integration - optimistic bundling of css feeds', async () => {
    const sink = new Sink();

    await publishAssets(sink, {
        tag: 'podlet1',
        type: 'css',
        data: [
            {
                id: 'c645cf572a8f5acf8716e4846b408d3b1ca45c58',
                source: 'h1 { color: red; }',
                deps: {},
                file: './assets/css/bar.js',
            },
        ],
    });

    await publishInstructions(sink, {
        tag: 'layout1',
        type: 'css',
        data: ['podlet1'],
    });

    expect(sink.db).toMatchSnapshot();
});

test('integration - publishing a feed via the /publish-assets endpoint', async () => {
    expect.assertions(1);
    const router = new Router();
    const { server } = await createTestServerFor(router.router());
    const post = supertest(server).post;
    const payload = {
        tag: 'podlet1',
        type: 'js',
        data: [
            {
                id: 'c645cf572a8f5acf8716e4846b408d3b1ca45c58',
                source:
                    '"use strict";module.exports.world=function(){return"world"};',
                deps: {},
                file: './assets/js/bar.js',
            },
        ],
    };
    const { body } = await post('/publish-assets')
        .send(payload)
        .expect(200);
    expect(body).toMatchSnapshot();
    return server.close();
});

test('integration - publishing bundling instructions via the /publish-instructions endpoint', async () => {
    expect.assertions(1);
    const router = new Router();
    const { server } = await createTestServerFor(router.router());
    const post = supertest(server).post;
    await post('/publish-assets').send({
        tag: 'podlet1',
        type: 'js',
        data: [
            {
                id: 'c645cf572a8f5acf8716e4846b408d3b1ca45c58',
                source:
                    '"use strict";module.exports.world=function(){return"world"};',
                deps: {},
                file: './assets/js/bar.js',
            },
        ],
    });
    const { body } = await post('/publish-instructions')
        .send({ tag: 'layout1', type: 'js', data: ['podlet1'] })
        .expect(200);

    expect(body.success).toBe(true);
    return server.close();
});

afterAll(() => endWorkers());
