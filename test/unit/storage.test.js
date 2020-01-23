'use strict';

const Sink = require('@asset-pipe/sink-mem');
const Storage = require('../../lib/storage');

beforeAll(() => jest.setTimeout(20000));

test('getTags() - no tags previously set', async () => {
    const sink = new Sink();
    const storage = new Storage(sink);
    const tags = ['tag1', 'tag2'];
    const result = await storage.getTags(tags, 'js');
    expect(result).toEqual([]);
});

test('getTags()', async () => {
    const sink = new Sink();
    const storage = new Storage(sink);
    await sink.set('/tags/js/tag1.txt', 'hash1');
    await sink.set('/tags/js/tag2.txt', 'hash2');
    await sink.set('/tags/js/tag3.txt', 'hash3');

    const tags = ['tag1', 'tag2'];
    const result = await storage.getTags(tags, 'js');
    expect(result).toEqual(['hash1', 'hash2']);
});

test('setTag() - no tags previously set', async () => {
    const sink = new Sink();
    const storage = new Storage(sink);
    await sink.set('/tags/js/tag2.txt', 'hash2');
    await sink.set('/tags/js/tag3.txt', 'hash3');

    await storage.setTag('tag1', 'js', 'hash1');
    expect(await sink.get('/tags/js/tag1.txt')).toBe('hash1');
});

test('setTag()', async () => {
    const sink = new Sink();
    const storage = new Storage(sink);
    await storage.setTag('tag1', 'js', 'hash1');
    expect(await sink.get('/tags/js/tag1.txt')).toBe('hash1');
});

test('hasTag() - false', async () => {
    const sink = new Sink();
    const storage = new Storage(sink);
    const result = await storage.hasTag('tag1', 'js');
    expect(result).toBe(false);
});

test('hasTag() - true', async () => {
    const sink = new Sink();
    const storage = new Storage(sink);
    await sink.set('/tags/js/tag1.txt', 'hash1');
    const result = await storage.hasTag('tag1', 'js');
    expect(result).toBe(true);
});

test('hasTags() - false', async () => {
    const sink = new Sink();
    const storage = new Storage(sink);
    const result = await storage.hasTags(['tag1'], 'js');
    expect(result).toBe(false);
});

test('hasTags() - true', async () => {
    const sink = new Sink();
    const storage = new Storage(sink);
    await sink.set('/tags/js/tag1.txt', 'hash1');
    await sink.set('/tags/js/tag2.txt', 'hash2');
    await sink.set('/tags/js/tag3.txt', 'hash3');
    const tags = ['tag1', 'tag2', 'tag3'];
    const result = await storage.hasTags(tags, 'js');
    expect(result).toBe(true);
});

test('setInstruction()', async () => {
    const sink = new Sink();
    const storage = new Storage(sink);
    await storage.setInstruction('tag', 'js', {});
    expect(await sink.get('/instructions/js/tag.json')).toEqual('{}');
});

test('getInstructions()', async () => {
    const sink = new Sink();
    const storage = new Storage(sink);
    await sink.set(
        '/instructions/js/tag1.json',
        JSON.stringify({ data: ['tag1'] }),
    );
    await sink.set(
        '/instructions/js/tag2.json',
        JSON.stringify({ data: ['tag1'] }),
    );
    await sink.set('/instructions/js/tag3.json', JSON.stringify({ data: [] }));
    const result = await storage.getInstructions('tag1', 'js');
    expect(result).toHaveLength(2);
});

test('getFeed()', async () => {
    const sink = new Sink();
    const storage = new Storage(sink);
    await sink.set('hash1.json', JSON.stringify([{}, {}]));
    const result = await storage.getFeed('hash1');
    expect(result).toHaveLength(2);
});

test('getFeed() - file doesnt exist, returns empty array', async () => {
    const sink = new Sink();
    const storage = new Storage(sink);
    const result = await storage.getFeed('hash1');
    expect(result).toHaveLength(0);
});

test('setFeed()', async () => {
    const sink = new Sink();
    const storage = new Storage(sink);
    await storage.setFeed('hash1', []);
    expect(await sink.get('hash1.json')).toEqual('[]');
});

test('setBundle()', async () => {
    const sink = new Sink();
    const storage = new Storage(sink);
    await storage.setBundle('hash1', 'js', 'dummy content');
    expect(await sink.get('hash1.js')).toBe('dummy content');
});

test('hasBundle() - false', async () => {
    const sink = new Sink();
    const storage = new Storage(sink);
    const result = await storage.hasBundle('hash1', 'js');
    expect(result).toBeFalsy();
});

test('hasBundle() - true', async () => {
    const sink = new Sink();
    const storage = new Storage(sink);
    sink.db['hash1.js'] = 'content';
    const result = await storage.hasBundle('hash1', 'js');
    expect(result).toBeTruthy();
});
