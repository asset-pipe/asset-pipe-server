'use strict';

const Storage = require('../../lib/storage');
const Sink = require('@asset-pipe/sink-mem');

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
    sink.db['meta/tags.json'] = JSON.stringify({
        'tag1/js': 'hash1',
        'tag2/js': 'hash2',
        'tag3/js': 'hash3',
    });
    const tags = ['tag1', 'tag2'];
    const result = await storage.getTags(tags, 'js');
    expect(result).toEqual(['hash1', 'hash2']);
});

test('setTag() - no tags previously set', async () => {
    const sink = new Sink();
    const storage = new Storage(sink);
    sink.db['meta/tags.json'] = JSON.stringify({
        'tag2/js': 'hash2',
        'tag3/js': 'hash3',
    });
    await storage.setTag('tag1', 'js', 'hash1');
    expect(sink.db['meta/tags.json']).toMatchSnapshot();
});

test('setTag()', async () => {
    const sink = new Sink();
    const storage = new Storage(sink);
    await storage.setTag('tag1', 'js', 'hash1');
    expect(sink.db['meta/tags.json']).toMatchSnapshot();
});

test('hasAllTags() - false', async () => {
    const sink = new Sink();
    const storage = new Storage(sink);
    const result = await storage.hasAllTags(['tag1'], 'js');
    expect(result).toBe(false);
});

test('hasAllTags() - true', async () => {
    const sink = new Sink();
    const storage = new Storage(sink);
    sink.db['meta/tags.json'] = JSON.stringify({
        'tag1/js': 'hash1',
        'tag2/js': 'hash2',
        'tag3/js': 'hash3',
    });
    const tags = ['tag1', 'tag2', 'tag3'];
    const result = await storage.hasAllTags(tags, 'js');
    expect(result).toBe(true);
});

test('setInstruction()', async () => {
    const sink = new Sink();
    const storage = new Storage(sink);
    await storage.setInstruction('tag', 'js', {});
    expect(sink.db).toMatchSnapshot();
});

test('getInstructions()', async () => {
    const sink = new Sink();
    const storage = new Storage(sink);
    sink.db['meta/instructions.json'] = JSON.stringify({
        'tag1/js': { data: ['tag1'] },
        'tag2/js': { data: ['tag1'] },
        'tag3/js': { data: [] },
    });
    const result = await storage.getInstructions('tag1');
    expect(result).toHaveLength(2);
});

test('getFeed()', async () => {
    const sink = new Sink();
    const storage = new Storage(sink);
    sink.db['hash1.json'] = JSON.stringify([{}, {}]);
    const result = await storage.getFeed('hash1');
    expect(result).toHaveLength(2);
});

test('setFeed()', async () => {
    const sink = new Sink();
    const storage = new Storage(sink);
    await storage.setFeed('hash1', []);
    expect(sink.db['hash1.json']).toBeTruthy();
});

test('setBundle()', async () => {
    const sink = new Sink();
    const storage = new Storage(sink);
    await storage.setBundle('hash1', 'js', '');
    expect(sink.db['hash1.js']).toBeTruthy();
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

test('find() - success', async () => {
    const sink = new Sink();
    const storage = new Storage(sink);
    sink.db.hash1 = JSON.stringify({ key: 'val' });
    const result = await storage.find('hash1', {});
    expect(result).toEqual({ key: 'val' });
});

test('find() - fails and uses defaultValue', async () => {
    const sink = new Sink();
    const storage = new Storage(sink);
    const result = await storage.find('hash1', []);
    expect(result).toEqual([]);
});
