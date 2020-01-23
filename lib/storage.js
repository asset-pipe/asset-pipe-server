'use strict';

const assert = require('assert');
const stringify = require('fast-json-stable-stringify');

module.exports = class Storage {
    constructor(sink) {
        assert(
            sink,
            'Expected "Storage" constructor to be given a "sink" instance.',
        );
        this.sink = sink;
    }

    async getTags(tags, type) {
        const result = await Promise.all(
            tags.map(tag => this.getTag(tag, type)),
        );
        return result.filter(Boolean);
    }

    async getTag(tag, type) {
        try {
            const result = await this.sink.get(`/tags/${type}/${tag}.txt`);
            return result.toString();
        } catch (err) {
            return null;
        }
    }

    async setTag(tag, type, hash) {
        await this.sink.set(`/tags/${type}/${tag}.txt`, hash, {
            public: false,
            private: true,
            metadata: {
                cacheControl: 'no-cache, no-store, must-revalidate',
            },
        });
    }

    hasTag(tag, type) {
        return this.sink.has(`/tags/${type}/${tag}.txt`);
    }

    async hasTags(tags, type) {
        const result = await Promise.all(
            tags.map(tag => this.hasTag(tag, type)),
        );
        return result.every(Boolean);
    }

    async setInstruction(tag, type, instruction) {
        await this.sink.set(
            `/instructions/${type}/${tag}.json`,
            stringify(instruction),
            {
                public: false,
                private: true,
                metadata: {
                    cacheControl: 'no-cache, no-store, must-revalidate',
                },
            },
        );
    }

    async getInstructions(tag, type) {
        try {
            const instructions = await this.sink.dir(`/instructions/${type}`);
            return instructions
                .map(({ content }) => JSON.parse(content))
                .filter(({ data }) => data.includes(tag));
        } catch (err) {
            return [];
        }
    }

    async getFeed(hash) {
        try {
            return JSON.parse(await this.sink.get(`${hash}.json`));
        } catch (err) {
            return [];
        }
    }

    async hasFeed(hash) {
        return this.sink.has(`${hash}.json`);
    }

    async setFeed(hash, content) {
        await this.sink.set(`${hash}.json`, stringify(content));
    }

    async setBundle(hash, extension, content) {
        await this.sink.set(`${hash}.${extension}`, content, {
            public: true,
            private: false,
            metadata: {
                cacheControl: 'public, max-age=365000000, immutable',
            },
        });
    }

    async hasBundle(hash, extension) {
        return this.sink.has(`${hash}.${extension}`);
    }
};
