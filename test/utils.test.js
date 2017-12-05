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
            throw new Error('Upload failed');
        },
    };

    try {
        await upload(sinkStub, 'filename.js', 'file content');
    } catch (err) {
        expect(err.message).toMatch(
            /Unable to upload file with name "filename.js"/
        );
    }
});
