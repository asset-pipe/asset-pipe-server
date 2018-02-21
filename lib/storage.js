'use strict';

const assert = require('assert');

module.exports = class Storage {
    constructor(sink) {
        assert(
            sink,
            'Expected "Storage" constructor to be given a "sink" instance.'
        );
        this.sink = sink;
    }

    async getTags(tags, type) {
        const contents = await this.sink.get(`meta/tags.json`);
        const tagStore = JSON.parse(contents || '{}');
        return tags.map(tag => tagStore[`${tag}/${type}`]);
    }

    async setTag(tag, type, hash) {
        let tags;
        try {
            const contents = await this.sink.get(`meta/tags.json`);
            tags = JSON.parse(contents || '{}');
        } catch (err) {
            tags = {};
        }
        tags[`${tag}/${type}`] = hash;
        await this.sink.set(`meta/tags.json`, JSON.stringify(tags, null, 2));
    }

    async hasAllTags(tags, type) {
        try {
            const contents = await this.sink.get(`meta/tags.json`);
            const tagsList = Object.keys(JSON.parse(contents || '{}'));
            return tags.every(tag => tagsList.includes(`${tag}/${type}`));
        } catch (err) {
            return false;
        }
    }

    async setInstruction(tag, type, instruction) {
        let instructions;
        try {
            const contents = await this.sink.get(`meta/instructions.json`);
            instructions = JSON.parse(contents || '{}');
        } catch (err) {
            instructions = {};
        }
        instructions[`${tag}/${type}`] = instruction;
        await this.sink.set(
            `meta/instructions.json`,
            JSON.stringify(instructions, null, 2)
        );
    }

    async getInstructions(tag) {
        try {
            const contents = await this.sink.get(`meta/instructions.json`);
            const instructions = JSON.parse(contents || '{}');
            return Object.values(instructions).filter(({ data }) =>
                data.includes(tag)
            );
        } catch (err) {
            return [];
        }
    }

    async getFeed(tag, hash) {
        const contents = await this.sink.get(`${tag}-${hash}.json`);
        return JSON.parse(contents || '{}');
    }

    async setFeed(tag, hash, content) {
        await this.sink.set(
            `${tag}-${hash}.json`,
            JSON.stringify(content, null, 2)
        );
    }

    async setBundle(hash, extension, content) {
        await this.sink.set(
            `${hash}.${extension}`,
            JSON.stringify(content, null, 2)
        );
    }

    async hasBundle(hash, extension) {
        try {
            const content = await this.sink.get(`${hash}.${extension}`);
            return Boolean(content);
        } catch (err) {
            return false;
        }
    }
};
