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
        const result = await Promise.all(
            tags.map(tag => this.getTag(tag, type))
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
        await this.sink.set(`/tags/${type}/${tag}.txt`, hash);
    }

    hasTag(tag, type) {
        return this.sink.has(`/tags/${type}/${tag}.txt`);
    }

    async hasTags(tags, type) {
        const result = await Promise.all(
            tags.map(tag => this.hasTag(tag, type))
        );
        return result.every(Boolean);
    }

    async setInstruction(tag, type, instruction) {
        await this.sink.set(
            `/instructions/${type}/${tag}.json`,
            JSON.stringify(instruction)
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

    async setFeed(hash, content) {
        await this.sink.set(`${hash}.json`, JSON.stringify(content));
    }

    async setBundle(hash, extension, content) {
        await this.sink.set(`${hash}.${extension}`, content);
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
