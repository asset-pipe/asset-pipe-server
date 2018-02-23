'use strict';

const Hasher = require('../../lib/hasher');

test('hashArray()', async () => {
    const ids = [
        'c645cf572a8f5acf8716e4846b408d3b1ca45c58',
        'b645cf572a8f5acf8716e4846b408d3b1ca45c58',
        'a645cf572a8f5acf8716e4846b408d3b1ca45c58',
    ];
    const result = await Hasher.hashArray(ids);
    expect(result).toBe(
        'fb61be35461b2ffc11d4109c201be02fe91177e86b23ecb0ad710711e41b2522'
    );
});

test('hashContent()', async () => {
    const content = 'content to be hashed';
    const result = Hasher.hashContent(content);
    expect(result).toBe(
        '48a4ac93a995382ff66ad56ba932c185f908c7179481f0373eb450e357c3c305'
    );
});

test('hashContent() - non string content handled', async () => {
    const content = {};
    const result = Hasher.hashContent(content);
    expect(result).toBe(
        '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a'
    );
});
