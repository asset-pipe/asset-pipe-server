'use strict';

const Joi = require('joi');

/**
 * Validator for a "file" String
 * Regex: https://regexper.com/#%5E%5Ba-zA-Z0-9._-%5D%2B%5C.(json|js)%24
 */

const file = Joi.string()
    .regex(/^[a-zA-Z0-9._-]+\.(json|js|css)$/)
    .lowercase()
    .trim()
    .required();

/**
 * Validator for a "ids" Array
 */

const ids = Joi.array()
    .label('Bundle payload')
    .required()
    .items(Joi.string().required())
    .sparse()
    .min(1)
    .max(100);

/**
 * Validator for a "tag" String
 */
const tag = Joi.string()
    .label('asset tag')
    .regex(/^[a-zA-Z0-9_-]+$/)
    .required();

/**
 * Validator for a "type" String
 */
const type = Joi.any()
    .label('file type')
    .required()
    .valid('js', 'css');

/**
 * Validator for a "bundle instruction" object
 */
const bundleInstruction = Joi.array()
    .label('bundle instruction')
    .items(Joi.string())
    .required();

/**
 * Validator for an "instruction" object
 */
const instruction = Joi.object()
    .label('instruction')
    .keys({ tag, type, data: bundleInstruction })
    .required();

/**
 * Validator for an "asset feed" object
 */
const assetFeed = Joi.array()
    .label('asset feed')
    .items(Joi.object())
    .required();

/**
 * Validator for an "assets" object
 */
const assets = Joi.object()
    .label('assets definition')
    .keys({ tag, type, data: assetFeed })
    .required();

module.exports = {
    file,
    ids,
    tag,
    type,
    bundleInstruction,
    instruction,
    assetFeed,
    assets,
};
