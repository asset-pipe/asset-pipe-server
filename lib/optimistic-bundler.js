'use strict';

const Storage = require('./storage');
const { hashArray, hashContent } = require('./hasher');
const { bundleFeeds } = require('./utils');
const Joi = require('joi');
const schemas = require('../lib/schemas');
const abslog = require('abslog');

module.exports = class OptimisticBundler {
    constructor(options) {
        const opts = {
            sourceMaps: false,
            minify: false,
            ...options,
        };
        this.storage = new Storage(options.sink);
        this.log = abslog(options.logger);
        this.options = opts;
    }

    async assetsPublished(tags, type) {
        const isPublished = await this.storage.hasTags(tags, type);

        this.log.info(
            `${type} assets for tag(s) "${tags.join(
                ', '
            )}" all published and ready for bundling?: ${isPublished}`
        );

        return isPublished;
    }

    getTags(tags, type) {
        return this.storage.getTags(tags, type);
    }

    getFeed(hash) {
        return this.storage.getFeed(hash);
    }

    hasBundle(hash, type) {
        return this.storage.hasBundle(hash, type);
    }

    setBundle(hash, type, content) {
        return this.storage.setBundle(hash, type, content);
    }

    getInstructions(tag, type) {
        return this.storage.getInstructions(tag, type);
    }

    setInstruction(tag, type, instruction) {
        return this.storage.setInstruction(tag, type, instruction);
    }

    setFeed(feedHash, assetFeed) {
        return this.storage.setFeed(feedHash, assetFeed);
    }

    setTag(tag, assetType, feedHash) {
        return this.storage.setTag(tag, assetType, feedHash);
    }

    async bundleExists(tags, type) {
        const hashes = await this.getTags(tags, type);
        const hash = await hashArray(hashes);
        const exists = await this.hasBundle(hash, type);
        this.log.info(
            `${type} bundle for tag(s) "${tags.join(
                ', '
            )}" already exists?: ${exists}`
        );

        return exists;
    }

    async getFeeds(tags, type) {
        const hashes = await this.getTags(tags, type);
        return Promise.all(
            tags.map((tag, index) => this.getFeed(hashes[index]))
        );
    }

    async bundle(tags, type) {
        const feeds = await this.getFeeds(tags, type);
        const content = await bundleFeeds(feeds, type, this.options);
        const hashes = await this.getTags(tags, type);
        const hash = await hashArray(hashes);
        return { content, hash };
    }

    async bundleIfNeeded(tags, type) {
        if (
            (await this.assetsPublished(tags, type)) &&
            !await this.bundleExists(tags, type)
        ) {
            this.log.debug(
                `${type} bundle for instruction: "[${tags.join(
                    ', '
                )}]" will be produced: true`
            );

            const { content, hash } = await this.bundle(tags, type);
            await this.setBundle(hash, type, content);

            this.log.info(
                `${type} bundle for instruction: "[${tags.join(
                    ', '
                )}]" completed and saved as: "${hash}.${type}"`
            );
        } else {
            this.log.debug(
                `${type} bundle for instruction: "[${tags.join(
                    ', '
                )}]" will be produced: false`
            );
        }
    }

    async bundleInstructions(instructions) {
        return Promise.all(
            instructions.map(({ data, type }) =>
                this.bundleIfNeeded(data, type)
            )
        );
    }

    async rebundle(tag, type) {
        const instructions = await this.getInstructions(tag, type);
        if (instructions.length) {
            await this.bundleInstructions(instructions);
        }
    }

    async publishInstructions(instruction) {
        const { tag, type, data: tags } = Joi.attempt(
            instruction,
            schemas.instruction,
            `Invalid 'instruction' object given when attempting to publish instructions.`
        );

        await this.setInstruction(tag, type, instruction);

        this.log.info(
            `${type} bundling instruction "[${tags.join(
                ', '
            )}]" published to "instructions.json" as "${tag}/${type}"`
        );

        await this.bundleIfNeeded(tags, type);
    }

    async publishAssets(assets) {
        const { tag, type, data: assetFeed } = Joi.attempt(
            assets,
            schemas.assets,
            `Invalid 'assets' object given when attempting to publish assets.`
        );

        this.log.debug(
            `request to publish ${type} asset feed for tag "${tag}" received`
        );

        const feedHash = hashContent(assetFeed);
        await this.setFeed(feedHash, assetFeed);

        this.log.info(
            `${type} asset feed for tag "${tag}" published as "${feedHash}.json"`
        );

        await this.setTag(tag, type, feedHash);

        this.log.debug(
            `${type} tag metadata updated. "${tag}/${type} => ${feedHash}"`
        );

        await this.rebundle(tag, type);

        this.log.debug(`${type} rebundling for tag "${tag}" complete`);

        return { id: feedHash, file: `${feedHash}.json` };
    }
};
