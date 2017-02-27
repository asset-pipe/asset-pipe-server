'use strict';

const Joi = require('joi');


/**
  * Validator for a "file" String
  * Regex: https://regexper.com/#%5E%5Ba-zA-Z0-9._-%5D%2B%5C.(json|js)%24
  */

module.exports.file = Joi
    .string()
    .regex(/^[a-zA-Z0-9._-]+\.(json|js)$/)
    .lowercase()
    .trim()
    .required();


/**
  * Validator for a "ids" Array
  */

module.exports.ids = Joi.array()
    .required()
    .items(Joi.string().required())
    .sparse()
    .min(1)
    .max(100);
