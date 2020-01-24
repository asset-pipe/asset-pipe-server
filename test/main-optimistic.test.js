'use strict';

const express = require('express');
const supertest = require('supertest');
const { hashArray } = require('@asset-pipe/common');
const Sink = require('@asset-pipe/sink-mem');
const { hashContent } = require('../lib/hasher');
const Router = require('../lib/main');

const mockMetaStorageSet = jest.fn().mockName('metaStorageSet');

jest.mock(
    '../lib/meta-storage',
    () =>
        class FakeMetaStorage {
            async set(id, ...rest) {
                if (id.endsWith('boom')) {
                    throw new Error('Boom');
                }

                return mockMetaStorageSet(id, ...rest);
            }
        },
);

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

beforeAll(() => jest.setTimeout(20000));

const cssFeed1 = [
    {
        id: '4f32a8e1c6cf6e5885241f3ea5fee583560b2dfde38b21ec3f9781c91d58f42e',
        name: 'my-module-1',
        version: '1.0.1',
        file: 'my-module-1/main.css',
        deps: {},
        source: '/* my-module-1/main.css */\nh2: { color: green; }\n',
    },
];

const cssFeed2 = [
    {
        id: '2f32a8c1c6cf6e5885f41f3ea5fee583560b2dfde38b21ec3f9781c91d58f45b',
        name: 'my-module-2',
        version: '1.0.1',
        file: 'my-module-2/main.css',
        deps: {},
        source: '/* my-module-2/main.css */\nh1 { color:blue; }\n',
    },
];
const jsFeed1 = [
    {
        id: '1d32a8e1c6cf6e5885241f3ea5fee583560b2dfde38b21ec3f9781c91d58f42e',
        name: 'my-module-1',
        version: '1.0.1',
        file: 'my-module-1/main.js',
        deps: {},
        source: 'const i = 1;',
    },
];

const jsFeed2 = [
    {
        id: '2g32a8c1c6cf6e5885f41f3ea5fee583560b2dfde38b21ec3f9781c91d58f45b',
        name: 'my-module-2',
        version: '1.0.1',
        file: 'my-module-2/main.js',
        deps: {},
        source: 'const x = 2;',
    },
];

describe('publishing and bundling css feeds', () => {
    test('publish assets and instructions together', async () => {
        const sink = new Sink();
        const router = new Router(sink);
        const { server } = await createTestServerFor(router.router());
        const { get, post } = supertest(server);
        const feed1 = {
            tag: 'podlet1',
            type: 'css',
            data: cssFeed1,
        };
        const feed2 = {
            tag: 'podlet2',
            type: 'css',
            data: cssFeed2,
        };
        const instructions = {
            tag: 'layout1',
            type: 'css',
            data: ['podlet1', 'podlet2'],
        };

        await Promise.all([
            post('/publish-assets').send(feed1),
            post('/publish-instructions').send(instructions),
            post('/publish-assets').send(feed2),
        ]);

        const hash = hashArray([hashContent(cssFeed1), hashContent(cssFeed2)]);
        const { text } = await get(`/bundle/${hash}.css`);
        expect(text).toMatchSnapshot();
        await server.close();
    });

    test('publish instructions before assets', async () => {
        const sink = new Sink();
        const router = new Router(sink);
        const { server } = await createTestServerFor(router.router());
        const { get, post } = supertest(server);
        const feed1 = {
            tag: 'podlet1',
            type: 'css',
            data: cssFeed1,
        };
        const feed2 = {
            tag: 'podlet2',
            type: 'css',
            data: cssFeed2,
        };
        const instructions = {
            tag: 'layout1',
            type: 'css',
            data: ['podlet1', 'podlet2'],
        };

        await post('/publish-instructions').send(instructions);
        await Promise.all([
            post('/publish-assets').send(feed1),
            post('/publish-assets').send(feed2),
        ]);

        const hash = hashArray([hashContent(cssFeed1), hashContent(cssFeed2)]);
        const { text } = await get(`/bundle/${hash}.css`);
        expect(text).toMatchSnapshot();
        await server.close();
    });

    test('publish assets before instructions', async () => {
        const sink = new Sink();
        const router = new Router(sink);
        const { server } = await createTestServerFor(router.router());
        const { get, post } = supertest(server);
        const feed1 = {
            tag: 'podlet1',
            type: 'css',
            data: cssFeed1,
        };
        const feed2 = {
            tag: 'podlet2',
            type: 'css',
            data: cssFeed2,
        };
        const instructions = {
            tag: 'layout1',
            type: 'css',
            data: ['podlet1', 'podlet2'],
        };

        await Promise.all([
            post('/publish-assets').send(feed1),
            post('/publish-assets').send(feed2),
        ]);
        await post('/publish-instructions').send(instructions);

        const hash = hashArray([hashContent(cssFeed1), hashContent(cssFeed2)]);
        const { text } = await get(`/bundle/${hash}.css`);
        expect(text).toMatchSnapshot();
        await server.close();
    });
});

describe('publishing and bundling js feeds', () => {
    test('should respond with 400 on bad request', async () => {
        const sink = new Sink();
        const router = new Router(sink);
        const { server } = await createTestServerFor(router.router());
        const { post } = supertest(server);
        const instructions = {
            data: ['podlet1', 'podlet2'],
        };

        await post('/publish-instructions')
            .send(instructions)
            .expect(400);

        await server.close();
    });

    test('publish assets and instructions together', async () => {
        const sink = new Sink();
        const router = new Router(sink);
        const { server } = await createTestServerFor(router.router());
        const { get, post } = supertest(server);
        const feed1 = {
            tag: 'podlet1',
            type: 'js',
            data: jsFeed1,
        };
        const feed2 = {
            tag: 'podlet2',
            type: 'js',
            data: jsFeed2,
        };
        const instructions = {
            tag: 'layout1',
            type: 'js',
            data: ['podlet1', 'podlet2'],
        };

        await Promise.all([
            post('/publish-assets').send(feed1),
            post('/publish-instructions').send(instructions),
            post('/publish-assets').send(feed2),
        ]);

        const hash = hashArray([hashContent(jsFeed1), hashContent(jsFeed2)]);
        const { text } = await get(`/bundle/${hash}.js`);
        expect(text).toMatchSnapshot();
        await server.close();
    });

    test('publish instructions before assets', async () => {
        const sink = new Sink();
        const router = new Router(sink);
        const { server } = await createTestServerFor(router.router());
        const { get, post } = supertest(server);
        const feed1 = {
            tag: 'podlet1',
            type: 'js',
            data: jsFeed1,
        };
        const feed2 = {
            tag: 'podlet2',
            type: 'js',
            data: jsFeed2,
        };
        const instructions = {
            tag: 'layout1',
            type: 'js',
            data: ['podlet1', 'podlet2'],
        };

        await post('/publish-instructions').send(instructions);
        await Promise.all([
            post('/publish-assets').send(feed1),
            post('/publish-assets').send(feed2),
        ]);

        const hash = hashArray([hashContent(jsFeed1), hashContent(jsFeed2)]);
        const { text } = await get(`/bundle/${hash}.js`);
        expect(text).toMatchSnapshot();
        await server.close();
    });

    test('publish assets before instructions', async () => {
        const sink = new Sink();
        const router = new Router(sink);
        const { server } = await createTestServerFor(router.router());
        const { get, post } = supertest(server);
        const feed1 = {
            tag: 'podlet1',
            type: 'js',
            data: jsFeed1,
        };
        const feed2 = {
            tag: 'podlet2',
            type: 'js',
            data: jsFeed2,
        };
        const instructions = {
            tag: 'layout1',
            type: 'js',
            data: ['podlet1', 'podlet2'],
        };

        await Promise.all([
            post('/publish-assets').send(feed1),
            post('/publish-assets').send(feed2),
        ]);
        await post('/publish-instructions').send(instructions);

        const hash = hashArray([hashContent(jsFeed1), hashContent(jsFeed2)]);
        const { text } = await get(`/bundle/${hash}.js`);
        expect(text).toMatchSnapshot();
        await server.close();
    });

    test('publish assets with rebundle disabled', async () => {
        const sink = new Sink();
        const router = new Router(sink);
        const { server } = await createTestServerFor(router.router());
        const { get, post } = supertest(server);
        const feed1 = {
            tag: 'podlet1',
            type: 'js',
            data: jsFeed1,
        };

        const {
            body: { id },
        } = await post('/publish-assets?rebundle=false').send(feed1);

        const { text } = await get(`/feed/${id}.js`);
        expect(text).toMatchSnapshot();
        sink.domain = null;
        expect(sink).toMatchSnapshot();
        await server.close();
    });

    test('retrieving feeds published via optimistic bundling', async () => {
        const sink = new Sink();
        const router = new Router(sink);
        const { server } = await createTestServerFor(router.router());
        const { get, post } = supertest(server);
        const feed1 = {
            tag: 'podlet1',
            type: 'js',
            data: jsFeed1,
        };
        const {
            body: { id },
        } = await post('/publish-assets').send(feed1);
        const { text } = await get(`/feed/${id}.json`);
        expect(text).toMatchSnapshot();
        await server.close();
    });

    test('endpoint errors handled', async () => {
        const sink = new Sink();
        const router = new Router(sink);
        const { server } = await createTestServerFor(router.router());
        const { post } = supertest(server);
        await post('/publish-assets').expect(400);
        await post('/publish-instructions').expect(400);
        await server.close();
    });

    test('info logs get emitted', async done => {
        expect.hasAssertions();
        const sink = new Sink();
        const router = new Router(sink);
        router.once('info', log => {
            expect(log).toMatchSnapshot();
            done();
        });
        const { server } = await createTestServerFor(router.router());
        const { post } = supertest(server);
        const feed1 = {
            tag: 'podlet1',
            type: 'js',
            data: jsFeed1,
        };
        await post('/publish-assets').send(feed1);
        await server.close();
    });

    test('debug logs get emitted', async done => {
        expect.hasAssertions();
        const sink = new Sink();
        const router = new Router(sink);
        router.once('debug', log => {
            expect(log).toMatchSnapshot();
            done();
        });
        const { server } = await createTestServerFor(router.router());
        const { post } = supertest(server);
        const feed1 = {
            tag: 'podlet1',
            type: 'js',
            data: jsFeed1,
        };
        await post('/publish-assets').send(feed1);
        await server.close();
    });

    test('info logs get logged when logger is provided', async () => {
        expect.hasAssertions();
        const sink = new Sink();
        const logger = {
            trace() {},
            debug() {},
            info: jest.fn(),
            warn() {},
            error() {},
            fatal() {},
        };
        const router = new Router(sink, { logger });
        const { server } = await createTestServerFor(router.router());
        const { post } = supertest(server);
        const feed1 = {
            tag: 'podlet1',
            type: 'js',
            data: jsFeed1,
        };
        await post('/publish-assets').send(feed1);
        expect(logger.info).toMatchSnapshot();
        await server.close();
    });

    test('metrics generated for asset publish', async () => {
        expect.hasAssertions();
        const sink = new Sink();
        const router = new Router(sink);
        const buff = [];
        router.metrics.on('data', chunk => buff.push(chunk));
        const { server } = await createTestServerFor(router.router());
        const { post } = supertest(server);
        const feed1 = {
            tag: 'podlet1',
            type: 'js',
            data: jsFeed1,
        };
        await post('/publish-assets').send(feed1);
        await server.close();
        expect(buff).toHaveLength(11);
        const obj = buff[0].toJSON();
        expect(obj.name).toEqual('asset_server_exists_in_storage_timer');
        expect(obj.description).toEqual(
            'Time taken for a check for existence operation from storage',
        );
        expect(obj.type).toEqual(5);
        expect(obj.meta.buckets).toEqual([1, 5, 10, 15, 20, 30, 60, 120]);
    });
});
