'use strict';

beforeEach(() => jest.resetModules());

test('bundleFeeds() throws error when bundling JS', async () => {
    expect.hasAssertions();
    const { bundleFeeds, endWorkers } = require('../lib/utils');

    try {
        await bundleFeeds(
            ['d1fg23d12gf3d.json', 'gfd123fd123fg123.json'],
            'js'
        );
    } catch (err) {
        expect(err.message).toMatch(/Unable to bundle feeds as JS/);
    } finally {
        endWorkers();
    }
});

test('bundleFeeds() throws error when bundling CSS', async () => {
    expect.hasAssertions();
    const { bundleFeeds, endWorkers } = require('../lib/utils');

    try {
        await bundleFeeds(
            ['d1fg23d12gf3d.json', 'gfd123fd123fg123.json'],
            'css'
        );
    } catch (err) {
        expect(err.message).toMatch(/Unable to bundle feeds as CSS/);
    } finally {
        endWorkers();
    }
});

test('upload() handles errors correctly', async () => {
    expect.hasAssertions();
    const { upload, endWorkers } = require('../lib/utils');
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
    } finally {
        endWorkers();
    }
});

test('passing options to bundleFeeds()', async () => {
    expect.hasAssertions();
    const { bundleFeeds, endWorkers } = require('../lib/utils');
    const feed = [
        {
            id: 'c645cf572a8f5acf8716e4846b408d3b1ca45c58',
            entry: true,
            source: 'console.log(process.env.NODE_ENV)',
            deps: {},
            file: './assets/js/hello.js',
        },
    ];

    const result = await bundleFeeds([feed], 'js', { env: 'production' });
    expect(result).toMatch('production');
    expect(result).toMatchSnapshot();
    endWorkers();
});
