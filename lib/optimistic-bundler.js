'use strict';

const Storage = require('./storage');
const Hasher = require('./hasher');
const { bundleFeeds } = require('./utils');

module.exports = class OptimisticBundler {
    constructor(sink) {
        this.storage = new Storage(sink);
    }

    assetsPublished(tags, type) {
        return this.storage.hasAllTags(tags, type);
    }

    getTags(tags, type) {
        return this.storage.getTags(tags, type);
    }

    getFeed(tag, hash) {
        return this.storage.getFeed(tag, hash);
    }

    hasBundle(hash, type) {
        return this.storage.hasBundle(hash, type);
    }

    setBundle(hash, type, content) {
        return this.storage.setBundle(hash, type, content);
    }

    getInstructions(tag) {
        return this.storage.getInstructions(tag);
    }

    setInstruction(tag, type, instruction) {
        return this.storage.setInstruction(tag, type, instruction);
    }

    setFeed(tag, feedHash, assetFeed) {
        return this.storage.setFeed(tag, feedHash, assetFeed);
    }

    setTag(tag, assetType, feedHash) {
        return this.storage.setTag(tag, assetType, feedHash);
    }

    async bundleExists(tags, type) {
        const hashes = await this.getTags(tags, type);
        const hash = await Hasher.hashArray(hashes);
        return this.hasBundle(hash, type);
    }

    async getFeeds(tags, type) {
        const hashes = await this.getTags(tags, type);
        return Promise.all(
            tags.map((tag, index) => this.getFeed(tag, hashes[index]))
        );
    }

    async bundle(tags, type) {
        const feeds = await this.getFeeds(tags, type);
        const content = await bundleFeeds(feeds, type);
        const hashes = await this.getTags(tags, type);
        const hash = await Hasher.hashArray(hashes);
        return { content, hash };
    }

    async bundleIfNeeded(tags, type) {
        if (
            (await this.assetsPublished(tags, type)) &&
            !await this.bundleExists(tags, type)
        ) {
            const { content, hash } = await this.bundle(tags, type);
            await this.setBundle(hash, type, content);
        }
    }

    async bundleInstructions(instructions) {
        return Promise.all(
            instructions.map(({ data, type }) =>
                this.bundleIfNeeded(data, type)
            )
        );
    }

    async rebundle(tag) {
        return this.bundleInstructions(await this.getInstructions(tag));
    }

    async publishInstructions(instruction) {
        const { tag, type, data: tags } = instruction;
        await this.setInstruction(tag, type, instruction);
        await this.bundleIfNeeded(tags, type);
    }

    async publishAssets({ tag, type, data: assetFeed }) {
        const feedHash = Hasher.hashContent(assetFeed);
        await this.setFeed(tag, feedHash, assetFeed);
        await this.setTag(tag, type, feedHash);
        await this.rebundle(tag);
        return { id: feedHash, file: `${tag}-${feedHash}.json` };
    }
};
