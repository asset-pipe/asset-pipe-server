'use strict';

beforeEach(() => jest.resetModules());

test('bundleFeeds() throws error when bundling JS', async () => {
    expect.hasAssertions();
    jest.doMock('@asset-pipe/js-reader', () => () =>
        Promise.reject(new Error())
    );
    const { bundleFeeds } = require('../lib/utils');

    try {
        await bundleFeeds(
            ['d1fg23d12gf3d.json', 'gfd123fd123fg123.json'],
            'js'
        );
    } catch (err) {
        expect(err.message).toMatch(/Unable to bundle feeds as JS/);
    }
});

test('bundleFeeds() throws error when bundling CSS', async () => {
    expect.hasAssertions();
    jest.doMock('@asset-pipe/css-reader', () => () =>
        Promise.reject(new Error())
    );
    const { bundleFeeds } = require('../lib/utils');

    try {
        await bundleFeeds(
            ['d1fg23d12gf3d.json', 'gfd123fd123fg123.json'],
            'css'
        );
    } catch (err) {
        expect(err.message).toMatch(/Unable to bundle feeds as CSS/);
    }
});

test('upload() handles errors correctly', async () => {
    expect.hasAssertions();
    const { upload } = require('../lib/utils');
    const sinkStub = {
        async set() {
            throw new Error();
        },
    };

    try {
        await upload(sinkStub, 'filename.js', 'file content');
    } catch (err) {
        expect(err.message).toMatch(
            /Unable to upload bundle with fileName "filename.js"/
        );
    }
});

test('fetchFeeds() handles missing file errors as 404s', async () => {
    expect.hasAssertions();
    const { fetchFeeds } = require('../lib/utils');
    const sinkStub = {
        async get() {
            throw new Error('No file with name');
        },
    };

    try {
        await fetchFeeds(sinkStub, ['sfd123ds123fds12.json']);
    } catch (err) {
        expect(err.output.statusCode).toBe(404);
    }
});

test('fetchFeeds() handles non missing file errors as 500s', async () => {
    expect.hasAssertions();
    const { fetchFeeds } = require('../lib/utils');
    const sinkStub = {
        async get() {
            throw new Error();
        },
    };

    try {
        await fetchFeeds(sinkStub, ['sfd123ds123fds12.json']);
    } catch (err) {
        expect(err.output.statusCode).toBe(500);
    }
});

test('fetchFeeds() retries on non file not found failures', async () => {
    expect.hasAssertions();
    const { fetchFeeds } = require('../lib/utils');
    let count = 0;
    const sinkStub = {
        async get() {
            if (count++ > 1) {
                return 'feed content';
            }
            throw new Error();
        },
    };

    await expect(
        fetchFeeds(sinkStub, ['sfd123ds123fds12.json'], 3)
    ).resolves.toEqual([
        { contents: 'feed content', fileName: 'sfd123ds123fds12.json' },
    ]);
});

test('fetchFeeds() aborts retries on file not found failures', async () => {
    expect.hasAssertions();
    const { fetchFeeds } = require('../lib/utils');
    const sinkStub = {
        get: jest.fn(() => Promise.reject(new Error('No file with name'))),
    };

    try {
        await fetchFeeds(sinkStub, ['sfd123ds123fds12.json'], 3);
    } catch (err) {
        const spyCount = sinkStub.get.mock.calls[0].length;
        expect(spyCount).toBe(1);
    }
});

test('upload() retries on failures', async () => {
    expect.hasAssertions();
    const { upload } = require('../lib/utils');
    let count = 0;
    const sinkStub = {
        async set() {
            if (count++ > 1) {
                return 'upload success';
            }
            throw new Error();
        },
    };

    await expect(() =>
        upload(sinkStub, 'filename.js', 'file content', 3)
    ).not.toThrow();
});
