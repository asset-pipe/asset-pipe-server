'use strict';

const Joi = require('joi');
const abslog = require('abslog');
const { hashArray } = require('@asset-pipe/common');
const Metrics = require('@metrics/client');
const Bundler = require('./bundler');
const Storage = require('./storage');
const schemas = require('../lib/schemas');
const { hashContent } = require('./hasher');

const PERSIST_TO_STORAGE_METRIC = {
    name: 'asset_server_persist_to_storage_timer',
    description: 'Time taken for a persist operation to storage',
};

const RETRIEVE_FROM_STORAGE_METRIC = {
    name: 'asset_server_retrieve_from_storage_timer',
    description: 'Time taken for a retrieve operation from storage',
};

const EXISTS_IN_STORAGE_METRIC = {
    name: 'asset_server_exists_in_storage_timer',
    description: 'Time taken for a check for existence operation from storage',
};

module.exports = class OptimisticBundler extends Bundler {
    constructor({ bundleInProcess, ...options }) {
        super({ bundleInProcess });

        const opts = {
            sourceMaps: false,
            minify: false,
            ...options,
        };
        this.storage = new Storage(options.sink);
        this.metrics = new Metrics();
        this.log = abslog(options.logger);
        this.options = opts;
        this.overrides = {};
    }

    async assetsPublished(tags, hashes, type) {
        const hasFeeds = await this.hasFeeds(hashes);
        const isPublished =
            hasFeeds && tags.length === hashes.length && hashes.length > 0;

        this.log.info(
            `${type} assets for tag(s) "${tags.join(
                ', ',
            )}" all published and ready for bundling?: ${isPublished}`,
        );

        return isPublished;
    }

    async getTags(tags, type) {
        const end = this.metrics.timer(RETRIEVE_FROM_STORAGE_METRIC);

        const storageTags = await this.storage.getTags(tags, type);

        end({ meta: { method: 'getTags' } });

        return storageTags;
    }

    async getFeed(hash) {
        const end = this.metrics.timer(RETRIEVE_FROM_STORAGE_METRIC);

        const feed = await this.storage.getFeed(hash);

        end({ meta: { method: 'getFeed' } });

        return feed;
    }

    async hasFeed(hash) {
        const end = this.metrics.timer(EXISTS_IN_STORAGE_METRIC);

        const hasFeed = await this.storage.hasFeed(hash);

        end({ meta: { method: 'hasFeed' } });

        return hasFeed;
    }

    async hasBundle(hash, type) {
        const end = this.metrics.timer(EXISTS_IN_STORAGE_METRIC);

        const hasBundle = await this.storage.hasBundle(hash, type);

        end({ meta: { method: 'hasBundle' } });

        return hasBundle;
    }

    async setBundle(hash, type, content) {
        const end = this.metrics.timer(PERSIST_TO_STORAGE_METRIC);

        await this.storage.setBundle(hash, type, content);

        end({ meta: { method: 'setBundle' } });
    }

    async getInstructions(tag, type) {
        const end = this.metrics.timer(RETRIEVE_FROM_STORAGE_METRIC);

        const instructions = await this.storage.getInstructions(tag, type);

        end({ meta: { method: 'getInstructions' } });

        return instructions;
    }

    async setInstruction(tag, type, instruction) {
        const end = this.metrics.timer(PERSIST_TO_STORAGE_METRIC);

        await this.storage.setInstruction(tag, type, instruction);

        end({ meta: { method: 'setInstruction' } });
    }

    async setFeed(feedHash, assetFeed) {
        const end = this.metrics.timer(PERSIST_TO_STORAGE_METRIC);

        await this.storage.setFeed(feedHash, assetFeed);

        end({ meta: { method: 'setFeed' } });
    }

    async setTag(tag, assetType, feedHash) {
        const end = this.metrics.timer(PERSIST_TO_STORAGE_METRIC);

        await this.storage.setTag(tag, assetType, feedHash);

        end({ meta: { method: 'setTag' } });
    }

    async bundleExists(tags, hashes, type) {
        const hash = hashArray(hashes);
        const exists = await this.hasBundle(hash, type);
        this.log.info(
            `${type} bundle (for tag(s) "${tags.join(
                ', ',
            )}" using hashes "${hashes.join(
                ',',
            )} to produce file ${hash}.${type}") already exists?: ${exists}`,
        );

        return exists;
    }

    async getFeeds(hashes) {
        return Promise.all(hashes.map(hash => this.getFeed(hash)));
    }

    async hasFeeds(hashes) {
        const result = await Promise.all(
            hashes.map(hash => this.storage.hasFeed(hash)),
        );
        return result.every(hasFeed => hasFeed === true);
    }

    async bundle(tag, tags, hashes, type) {
        const feeds = await this.getFeeds(hashes);

        const end = this.metrics.timer({
            name: 'asset_server_bundling_timer',
            description: 'Time taken to bundle assets',
            meta: {
                sources: tags,
                assetType: type,
                publisher: tag,
            },
        });

        const content = await super.bundleFeeds(feeds, type, {
            ...this.options,
            ...this.overrides,
        });
        const hash = hashArray(hashes);

        end();

        this.metrics.metric({
            name: 'asset_server_bundle_size_gauge',
            description: 'Measures the size of bundles created',
            value: Buffer.byteLength(content, 'utf8'),
            meta: {
                sources: tags,
                assetType: type,
                publisher: tag,
            },
        });

        return { content, hash };
    }

    async bundleIfNeeded(instruction) {
        const { data: tags, type, tag } = instruction;
        const hashes = await this.getTags(tags, type);
        if (
            (await this.assetsPublished(tags, hashes, type)) &&
            !(await this.bundleExists(tags, hashes, type))
        ) {
            this.log.debug(
                `${type} bundle for instruction: "[${tags.join(
                    ', ',
                )}]" using hashes: "[${hashes.join(
                    ', ',
                )}]" will be produced: true`,
            );

            const { content, hash } = await this.bundle(
                tag,
                tags,
                hashes,
                type,
            );
            await this.setBundle(hash, type, content);

            this.log.info(
                `${type} bundle for instruction: "[${tags.join(
                    ', ',
                )}]" completed and saved as: "${hash}.${type}"`,
            );
        } else {
            this.log.debug(
                `${type} bundle for instruction: "[${tags.join(
                    ', ',
                )}]" using hashes: "[${hashes.join(
                    ', ',
                )}]" will be produced: false`,
            );
        }
    }

    async bundleInstructions(instructions) {
        return Promise.all(
            instructions.map(instruction => this.bundleIfNeeded(instruction)),
        );
    }

    async rebundle(tag, type) {
        const end = this.metrics.timer({
            name: 'asset_server_rebundle_instructions_timer',
            description: 'Time taken to rebundle all instructions for a tag',
            meta: {
                assetType: type,
                publisher: tag,
            },
        });

        const instructions = await this.getInstructions(tag, type);
        if (instructions.length) {
            await this.bundleInstructions(instructions);
        }

        end();
    }

    async publishInstructions(instruction, options = {}) {
        const { tag, type, data: tags } = Joi.attempt(
            instruction,
            schemas.instruction,
            `Invalid 'instruction' object given when attempting to publish instructions.`,
        );

        const end = this.metrics.timer({
            name: 'asset_server_publish_instructions_timer',
            description: 'Time taken for publishInstructions() to complete',
            meta: {
                assetType: type,
                publisher: tag,
            },
        });

        this.overrides = options;

        await this.setInstruction(tag, type, instruction);

        this.log.info(
            `${type} bundling instruction "[${tags.join(
                ', ',
            )}]" published to "/instructions/${type}/${tag}.json"`,
        );

        await this.bundleIfNeeded(instruction);

        end();
    }

    async saveFallbackBundle(tag, hash, type, feed) {
        const end = this.metrics.timer({
            name: 'asset_server_save_fallback_bundle_timer',
            description:
                'Time taken for a fallback bundle to be bundled and saved',
            meta: {
                assetType: type,
                publisher: tag,
            },
        });

        if (await this.hasBundle(hash, type)) {
            this.log.info(
                `${type} fallback bundle for tag "${tag}" already exists as "${hash}.${type}" and will not be published`,
            );
        } else {
            const bundle = await super.bundleFeeds([feed], type);
            await this.setBundle(hash, type, bundle);

            this.metrics.metric({
                name: 'asset_server_fallback_bundle_size_gauge',
                description: 'Measures the size of fallback bundles created',
                value: Buffer.byteLength(bundle, 'utf8'),
                meta: {
                    assetType: type,
                    publisher: tag,
                },
            });

            this.log.info(
                `${type} fallback bundle for tag "${tag}" published as "${hash}.${type}"`,
            );
        }

        end();
    }

    async saveFeed(tag, hash, type, feed) {
        const end = this.metrics.timer({
            name: 'asset_server_save_feed_timer',
            description: 'Time taken for a feed to be saved to storage',
            meta: {
                assetType: type,
                publisher: tag,
            },
        });

        if (await this.hasFeed(hash)) {
            this.log.info(
                `${type} asset feed for tag "${tag}" already exists as "${hash}.json" and will not be published`,
            );
        } else {
            this.log.info(
                `${type} asset feed for tag "${tag}" published as "${hash}.json"`,
            );
            await this.setFeed(hash, feed);
        }

        end();
    }

    async publishAssets(assets, options) {
        const { tag, type, data: assetFeed } = Joi.attempt(
            assets,
            schemas.assets,
            `Invalid 'assets' object given when attempting to publish assets.`,
        );

        const end = this.metrics.timer({
            name: 'asset_server_publish_assets_timer',
            description:
                'Time taken for a publish assets operation to complete',
            meta: {
                assetType: type,
                publisher: tag,
            },
        });

        const opts = { rebundle: true, ...options };

        this.log.debug(
            `request to publish ${type} asset feed for tag "${tag}" received`,
        );

        this.overrides = opts;

        const feedHash = hashContent(assetFeed);
        await Promise.all([
            this.saveFeed(tag, feedHash, type, assetFeed),
            this.saveFallbackBundle(tag, feedHash, type, assetFeed),
        ]);

        if (opts.rebundle) {
            await this.setTag(tag, type, feedHash);

            this.log.debug(
                `${type} tag metadata updated. Wrote "${feedHash}" to "/tags/${type}/${tag}.txt"`,
            );

            await this.rebundle(tag, type);

            this.log.debug(`${type} rebundling for tag "${tag}" complete`);
        }

        end();

        return { id: feedHash, file: `${feedHash}.json` };
    }
};
