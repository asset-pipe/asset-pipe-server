'use strict';

const { booleanWithDefault } = require('../../lib/utils');

test('booleanWithDefault', () => {
    expect.hasAssertions();

    expect(booleanWithDefault('asdasd', 'fallback')).toBe('fallback');
    expect(booleanWithDefault(null, 'fallback')).toBe('fallback');
    expect(booleanWithDefault(undefined, 'fallback')).toBe('fallback');
    expect(booleanWithDefault(1, 'fallback')).toBe('fallback');
    expect(booleanWithDefault({}, 'fallback')).toBe('fallback');
    expect(booleanWithDefault('true', 'fallback')).toBe(true);
    expect(booleanWithDefault('false', 'fallback')).toBe(false);
    expect(booleanWithDefault(true, 'fallback')).toBe(true);
    expect(booleanWithDefault(false, 'fallback')).toBe(false);
});
