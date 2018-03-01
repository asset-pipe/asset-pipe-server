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

    async find(name, defaultValue) {
        try {
            const contents = await this.sink.get(name);
            return JSON.parse(contents);
        } catch (err) {
            return defaultValue;
        }
    }

    async saveOrCreate(name, value) {
        if (value === Object(value)) value = JSON.stringify(value, null, 2);
        await this.sink.set(name, value);
    }

    async getTags(tags, type) {
        const tagStore = await this.find(`meta/tags.json`, {});
        return tags.map(tag => tagStore[`${tag}/${type}`]).filter(Boolean);
    }

    async setTag(tag, type, hash) {
        const tags = await this.find(`meta/tags.json`, {});
        tags[`${tag}/${type}`] = hash;
        await this.saveOrCreate(`meta/tags.json`, tags);
    }

    async hasAllTags(tags, type) {
        const tagsList = Object.keys(await this.find(`meta/tags.json`, {}));
        return tags.every(tag => tagsList.includes(`${tag}/${type}`));
    }

    async setInstruction(tag, type, instruction) {
        const name = `meta/instructions.json`;
        const instructions = await this.find(name, {});
        instructions[`${tag}/${type}`] = instruction;
        await this.saveOrCreate(name, instructions);
    }

    async getInstructions(tag) {
        const instructions = await this.find(`meta/instructions.json`, {});
        return Object.values(instructions).filter(({ data }) =>
            data.includes(tag)
        );
    }

    getFeed(hash) {
        return this.find(`${hash}.json`, []);
    }

    async setFeed(hash, content) {
        await this.saveOrCreate(`${hash}.json`, content);
    }

    async setBundle(hash, extension, content) {
        await this.saveOrCreate(`${hash}.${extension}`, content);
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
