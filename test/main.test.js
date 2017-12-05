'use strict';

const express = require('express');
const SinkMem = require('@asset-pipe/sink-mem');
const SinkFs = require('@asset-pipe/sink-fs');
const Router = require('../lib/main');
const supertest = require('supertest');
const pretty = require('pretty');
const { PassThrough } = require('readable-stream');

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

describe('Router class', () => {
    test('new Router() with no arguments', () => {
        expect.assertions(1);
        const router = new Router();
        expect(router.sink).toBeInstanceOf(SinkMem);
    });

    test('new Router(sink) with sink argument', () => {
        expect.assertions(1);
        const sink = new SinkFs({ path: '/' });
        const router = new Router(sink);
        expect(router.sink).toBeInstanceOf(SinkFs);
    });

    test('new Router().router property', () => {
        expect.assertions(1);
        const router = new Router();
        expect(router.router.name).toEqual(express.Router().name); // eslint-disable-line new-cap
    });
});

describe('Router instance methods', () => {
    test('postFeedResponseCallback', done => {
        expect.assertions(5);
        const router = new Router();
        const json = jest.fn();
        const req = {
            method: 'POST',
            path: '/feed',
        };
        const res = {
            json,
            locals: { response: { file: 'foo' }, track: 'bar' },
        };
        router.on('request success', (track, method, path, file) => {
            expect(track).toBe('bar');
            expect(method).toBe('POST');
            expect(path).toBe('/feed');
            expect(file).toBe('foo');
            expect(json).toHaveBeenCalledWith({ file: 'foo' });
            done();
        });

        router.postFeedResponseCallback()(req, res);
    });

    test('getTestFileCallback: secure', () => {
        expect.assertions(1);
        const router = new Router();
        const send = jest.fn();
        const req = {
            params: { file: 'bar' },
            headers: { host: 'foo' },
            secure: true,
        };
        const res = {
            send,
        };

        router.getTestFileCallback()(req, res);
        expect(pretty(send.mock.calls[0][0])).toMatchSnapshot();
    });

    test('getTestFileCallback: insecure', () => {
        expect.assertions(1);
        const router = new Router();
        const send = jest.fn();
        const req = {
            params: { file: 'bar' },
            headers: { host: 'foo' },
            secure: false,
        };
        const res = {
            send,
        };

        router.getTestFileCallback()(req, res);
        expect(pretty(send.mock.calls[0][0])).toMatchSnapshot();
    });

    test('fileFoundCallback: detectable mime type', () => {
        expect.assertions(1);
        const router = new Router();
        router.sink.reader = jest.fn(() => {});
        const req = {
            method: 'get',
            path: '/',
            params: { file: 'bar.js' },
        };
        const res = new PassThrough();
        res.type = jest.fn();
        const fileStream = new PassThrough();
        res.locals = {};
        router.fileFoundCallback(req, res, fileStream);
        expect(res.type).toHaveBeenCalledWith('application/javascript');
    });

    test('fileFoundCallback: undetectable mime type', () => {
        expect.assertions(1);
        const router = new Router();
        router.sink.reader = jest.fn(() => {});
        const req = {
            method: 'get',
            path: '/',
            params: { file: 'bar' },
        };
        const res = new PassThrough();
        res.type = jest.fn();
        const fileStream = new PassThrough();
        res.locals = {};
        router.fileFoundCallback(req, res, fileStream);
        expect(res.type).toHaveBeenCalledWith(undefined);
    });

    test('statusErrors: json', () => {
        expect.assertions(1);
        const router = new Router();
        const req = {
            xhr: true,
        };
        const err = {
            output: {
                payload: { statusCode: 'foo' },
            },
        };
        const json = jest.fn();
        const res = {
            json,
            status() {
                return res;
            },
        };

        router.statusErrors()(err, req, res);

        expect(json).toHaveBeenCalledWith({ statusCode: 'foo' });
    });

    test('statusErrors: html', () => {
        expect.assertions(1);
        const router = new Router();
        const req = {
            accepts() {
                return 'html';
            },
        };
        const err = {
            output: {
                payload: { statusCode: 'foo', error: 'foo' },
            },
        };
        const send = jest.fn();
        const res = {
            send,
            status() {
                return res;
            },
        };

        router.statusErrors()(err, req, res);

        expect(send).toHaveBeenCalledWith(
            '<html><body><h1>foo</h1></body></html>'
        );
    });

    test('statusErrors: text', () => {
        expect.assertions(1);
        const router = new Router();
        const req = {
            accepts() {
                return 'text';
            },
        };
        const err = {
            output: {
                payload: { statusCode: 'foo', error: 'foo' },
            },
        };
        const send = jest.fn();
        const res = {
            send,
            status() {
                return res;
            },
        };

        router.statusErrors()(err, req, res);

        expect(send).toHaveBeenCalledWith('foo');
    });

    test('statusErrors: default', () => {
        expect.assertions(1);
        const router = new Router();
        const req = {
            accepts() {
                return 'foo';
            },
        };
        const err = {
            output: {
                payload: { statusCode: 'foo', error: 'foo' },
            },
        };
        const send = jest.fn();
        const res = {
            send,
            status() {
                return res;
            },
        };

        router.statusErrors()(err, req, res);

        expect(send).toHaveBeenCalledWith('Not Acceptable');
    });

    test('onError', () => {
        expect.assertions(1);
        const router = new Router();
        const next = jest.fn();
        const error = new Error('bar');

        router.onError(next)(error);

        expect(next.mock.calls[0][0]).toMatchSnapshot();
    });

    test('onError with message', () => {
        expect.assertions(1);
        const router = new Router();
        const next = jest.fn();
        const message = 'foo';
        const error = new Error('bar');

        router.onError(next, message)(error);

        expect(next.mock.calls[0][0]).toMatchSnapshot();
    });

    test('onPipelineEmpty', () => {
        expect.assertions(1);
        const router = new Router();
        const next = jest.fn();

        router.onPipelineEmpty(next)();

        expect(next.mock.calls[0][0]).toMatchSnapshot();
    });

    test('onFileNotFound', () => {
        expect.assertions(1);
        const router = new Router();
        const next = jest.fn();

        router.onFileNotFound(next)();

        expect(next).toHaveBeenCalled();
    });

    test('buildUri: secure', () => {
        expect.assertions(1);
        const router = new Router();

        const uri = router.buildUri('bar', 'foo', true);

        expect(uri).toBe('https://foo/bar/');
    });

    test('buildUri: insecure', () => {
        expect.assertions(1);
        const router = new Router();

        const uri = router.buildUri('bar', 'foo', false);

        expect(uri).toBe('http://foo/bar/');
    });
});

describe('uploading js feeds', () => {
    let router;
    let server;
    let port;
    let post;
    const singleFeed = [
        {
            id: 'c645cf572a8f5acf8716e4846b408d3b1ca45c58',
            source:
                '"use strict";module.exports.world=function(){return"world"};',
            deps: {},
            file: './assets/js/bar.js',
        },
    ];

    beforeEach(async () => {
        router = new Router();
        ({ server, port } = await createTestServerFor(router.router()));
        post = supertest(server).post;
    });

    test('/feed/js: empty array', async () =>
        post('/feed/js')
            .send([])
            .expect(400));

    test('/feed/js: empty string', async () =>
        post('/feed/js')
            .send('')
            .expect(400));

    test('/feed/js', async () => {
        expect.assertions(1);
        const { body } = await post('/feed/js')
            .send(singleFeed)
            .expect(200);

        expect(body).toEqual({
            file:
                'f652e904f72daa8bd884df867b69861bcb90be9508a1d558f05070d5d044d0d3.json',
            id:
                'f652e904f72daa8bd884df867b69861bcb90be9508a1d558f05070d5d044d0d3',
            uri: `http://127.0.0.1:${port}/feed/f652e904f72daa8bd884df867b69861bcb90be9508a1d558f05070d5d044d0d3.json`,
        });
    });

    afterEach(() => server.close());
});

describe('uploading css feeds', () => {
    let router;
    let server;
    const singleFeed = [
        {
            id:
                '4f32a8e1c6cf6e5885241f3ea5fee583560b2dfde38b21ec3f9781c91d58f42e',
            name: 'my-module-1',
            version: '1.0.1',
            file: 'my-module-1/main.css',
            content: '/* my-module-1/main.css */\n',
        },
    ];

    beforeEach(async () => {
        router = new Router();
        ({ server } = await createTestServerFor(router.router()));
    });

    test('/feed/css: empty array', async () =>
        supertest(server)
            .post('/feed/css')
            .send([])
            .expect(400));

    test('/feed/css: empty string', async () =>
        supertest(server)
            .post('/feed/css')
            .send('')
            .expect(400));

    test('/feed/css', async () =>
        supertest(server)
            .post('/feed/css')
            .send(singleFeed)
            .expect(200));

    afterEach(() => server.close());
});

describe('downloading feeds', () => {
    let router;
    let server;
    let file;
    let get;
    let post;
    const singleFeed = [
        {
            id: 'c645cf572a8f5acf8716e4846b408d3b1ca45c58',
            source:
                '"use strict";module.exports.world=function(){return"world"};',
            deps: {},
            file: './assets/js/bar.js',
        },
    ];

    beforeEach(async () => {
        router = new Router();
        ({ server } = await createTestServerFor(router.router()));
        ({ get, post } = supertest(server));

        const { body } = await post('/feed/js')
            .send(singleFeed)
            .expect(200);

        file = body.file;
    });

    test('/feed/:file', async () => {
        expect.assertions(5);
        router.on('request success', (track, method, path, fileName) => {
            expect(typeof track).toBe('string');
            expect(method).toBe('GET');
            expect(path).toBe(`/feed/${file}`);
            expect(fileName).toBe(`${file}`);
        });
        const { body } = await get(`/feed/${file}`)
            .expect('Content-Type', /application\/json/)
            .expect(200);

        expect(body).toMatchSnapshot();
    });

    test('/feed/invalid-path', () => get(`/feed/invalid-path`).expect(400));

    test('/feed/does-not-exist.json', () =>
        get(`/feed/does-not-exist.json`).expect(404));

    afterEach(() => server.close());
});

describe('bundling single js feed', () => {
    let server;
    let bundles;
    let router;
    const singleFeed = [
        {
            id: 'c645cf572a8f5acf8716e4846b408d3b1ca45c58',
            source:
                '"use strict";module.exports.world=function(){return"world"};',
            deps: {},
            file: './assets/js/bar.js',
        },
    ];

    beforeEach(async () => {
        router = new Router();
        ({ server } = await createTestServerFor(router.router()));

        const { body } = await supertest(server)
            .post('/feed/js')
            .send(singleFeed)
            .expect(200);
        bundles = [body.file];
    });

    test('/bundle/js', async () => {
        expect.assertions(1);
        const { body } = await supertest(server)
            .post('/bundle/js')
            .send(bundles)
            .expect(200);

        body.uri = body.uri.replace(/http:\/\/[0-9.:]+/, '');
        expect(body).toMatchSnapshot();
    });

    test('/bundle/js with body as empty array', () =>
        supertest(server)
            .post('/bundle/js')
            .send([])
            .expect(400));

    test('/bundle/js with empty body', () =>
        supertest(server)
            .post('/bundle/js')
            .expect(400));

    test('/bundle/js with invalid bundle reference', () =>
        supertest(server)
            .post('/bundle/js')
            .send(['completelyfake.json'])
            .expect(404));

    test('invalid json response should error correctly', async () => {
        // Missing closing `}`
        router.sink.set('invalid.json', Buffer.from('{ "foo": "bar"'));

        const eventPromise = new Promise(resolve => {
            router.once('request error', async (_, __, ___, ____, error) =>
                resolve(error)
            );
        });

        const [errorEvent] = await Promise.all([
            eventPromise,
            supertest(server)
                .post('/bundle/js')
                .send(['invalid.json'])
                .expect(500),
        ]);

        expect(errorEvent.message).toMatch(
            /Unexpected end of JSON input while parsing near/
        );
        expect(errorEvent.isBoom).toBe(true);
    });

    afterEach(() => server.close());
});

describe('bundling multiple js feeds', () => {
    let server;
    let get;
    let fileName;
    const feed1 = [
        {
            id: 'c645cf572a8f5acf8716e4846b408d3b1ca45c58',
            source:
                '"use strict";module.exports.hello=function(){return"hello"};',
            deps: {},
            file: './assets/js/hello.js',
        },
    ];
    const feed2 = [
        {
            id: 'd645cf572a8f5srf8716e4846b408d3b1ca45c23',
            source:
                '"use strict";module.exports.world=function(){return"world"};',
            deps: {},
            file: './assets/js/world.js',
        },
    ];

    beforeEach(async () => {
        expect.assertions(2);
        const router = new Router();
        let post;
        ({ server } = await createTestServerFor(router.router()));
        ({ get, post } = supertest(server)); // eslint-disable-line prefer-const

        const uploadFeed1 = post('/feed/js')
            .send(feed1)
            .expect(200);
        const uploadFeed2 = post('/feed/js')
            .send(feed2)
            .expect(200);

        const responses = await Promise.all([uploadFeed1, uploadFeed2]);

        const { body } = await post('/bundle/js')
            .send(responses.map(({ body: { file } }) => file))
            .expect(200);

        const { text } = await get(`/bundle/${body.file}`).expect(200);
        expect(text).toMatchSnapshot();

        fileName = body.file;
        body.uri = body.uri.replace(/http:\/\/[0-9.:]+/, '');
        expect(body).toMatchSnapshot();
    });

    test('/bundle/:file', async () => {
        expect.assertions(4);
        const { text, headers } = await get(`/bundle/${fileName}`).expect(200);
        expect(headers['content-type']).toMatch(/application\/javascript/);
        expect(text).toMatchSnapshot();
    });

    test('/bundle/js with multiple invalid bundle reference', () =>
        supertest(server)
            .post('/bundle/js')
            .send(['completelyfake.json', 'alsocompletelyfake.json'])
            .expect(404));

    afterEach(() => server.close());
});

describe('bundling single css feed', () => {
    let server;
    let bundles;
    const singleFeed = [
        {
            id:
                '4f32a8e1c6cf6e5885241f3ea5fee583560b2dfde38b21ec3f9781c91d58f42e',
            name: 'my-module-1',
            version: '1.0.1',
            file: 'my-module-1/main.css',
            content: '/* my-module-1/main.css */\n',
        },
    ];

    beforeEach(async () => {
        const router = new Router();
        ({ server } = await createTestServerFor(router.router()));
        const post = supertest(server).post;
        const { body } = await post('/feed/css')
            .send(singleFeed)
            .expect(200);
        bundles = [body.file];
    });

    test('/bundle/css', async () => {
        expect.assertions(1);
        const { body } = await supertest(server)
            .post('/bundle/css')
            .send(bundles)
            .expect(200);

        body.uri = body.uri.replace(/http:\/\/[0-9.:]+/, '');
        expect(body).toMatchSnapshot();
    });

    test('/bundle/css with body as empty array', () =>
        supertest(server)
            .post('/bundle/css')
            .send([])
            .expect(400));

    test('/bundle/css with empty body', () =>
        supertest(server)
            .post('/bundle/css')
            .expect(400));

    test('/bundle/css with invalid bundle reference', () =>
        supertest(server)
            .post('/bundle/css')
            .send(['completelyfake.json'])
            .expect(404));

    afterEach(() => server.close());
});

describe('bundling multiple css feeds', () => {
    let server;
    let get;
    let fileName;

    beforeEach(async () => {
        expect.assertions(1);
        const router = new Router();
        let post;
        ({ server } = await createTestServerFor(router.router()));

        ({ get, post } = supertest(server)); // eslint-disable-line prefer-const
        const feed1 = [
            {
                id:
                    '4f32a8e1c6cf6e5885241f3ea5fee583560b2dfde38b21ec3f9781c91d58f42e',
                name: 'my-module-1',
                version: '1.0.1',
                file: 'my-module-1/main.css',
                content: '/* my-module-1/main.css */\nh2: { color: green; }\n',
            },
        ];
        const feed2 = [
            {
                id:
                    '2f32a8c1c6cf6e5885f41f3ea5fee583560b2dfde38b21ec3f9781c91d58f45b',
                name: 'my-module-2',
                version: '1.0.1',
                file: 'my-module-2/main.css',
                content: '/* my-module-2/main.css */\nh1 { color:blue; }\n',
            },
        ];

        const uploadFeed1 = post('/feed/css')
            .send(feed1)
            .expect(200);
        const uploadFeed2 = post('/feed/css')
            .send(feed2)
            .expect(200);

        const responses = await Promise.all([uploadFeed1, uploadFeed2]);

        const { body } = await post('/bundle/css')
            .send(responses.map(({ body: { file } }) => file))
            .expect(200);

        fileName = body.file;
        body.uri = body.uri.replace(/http:\/\/[0-9.:]+/, '');
        expect(body).toMatchSnapshot();
    });

    test('/bundle/:file', async () => {
        expect.assertions(3);
        const { text, headers } = await get(`/bundle/${fileName}`).expect(200);
        expect(headers['content-type']).toMatch(/text\/css/);
        expect(text).toMatchSnapshot();
    });

    test('/bundle/css with multiple invalid bundle references', () =>
        supertest(server)
            .post('/bundle/css')
            .send(['completelyfake.json', 'alsocompletelyfake.json'])
            .expect(404));

    afterEach(() => server.close());
});
