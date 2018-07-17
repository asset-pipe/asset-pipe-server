'use strict';

const Bundler = require('../lib/bundler');

test('bundleFeeds() throws error when bundling JS', async () => {
    expect.hasAssertions();
    const bundler = new Bundler({ bundleInProcess: true });

    try {
        await bundler.bundleFeeds(
            ['d1fg23d12gf3d.json', 'gfd123fd123fg123.json'],
            'js'
        );
    } catch (err) {
        expect(err.message).toMatch(/Unable to bundle feeds as JS/);
    }
});

test('bundleFeeds() throws error when bundling CSS', async () => {
    expect.hasAssertions();
    const bundler = new Bundler();

    try {
        await bundler.bundleFeeds(
            ['d1fg23d12gf3d.json', 'gfd123fd123fg123.json'],
            'css'
        );
    } catch (err) {
        expect(err.message).toMatch(/Unable to bundle feeds as CSS/);
    }
});

test('upload() handles errors correctly', async () => {
    expect.hasAssertions();
    const bundler = new Bundler({ bundleInProcess: true });

    const sinkStub = {
        async set() {
            throw new Error('Upload failed');
        },
    };

    try {
        await bundler.upload(sinkStub, 'filename.js', 'file content');
    } catch (err) {
        expect(err.message).toMatch(
            /Unable to upload file with name "filename.js"/
        );
    }
});

test('passing options to bundleFeeds()', async () => {
    expect.hasAssertions();
    const bundler = new Bundler({ bundleInProcess: true });

    const feed = [
        {
            id: 'c645cf572a8f5acf8716e4846b408d3b1ca45c58',
            entry: true,
            source: 'console.log(process.env.NODE_ENV)',
            deps: {},
            file: './assets/js/hello.js',
        },
    ];

    const result = await bundler.bundleFeeds([feed], 'js', {
        env: 'production',
    });
    expect(result).toMatch('production');
    expect(result).toMatchSnapshot();
});

test('endWorkers does not explode even though bundleInProcess=true', () => {
    const bundler = new Bundler({ bundleInProcess: true });
    return bundler.endWorkers();
});
