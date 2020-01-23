/* eslint-disable consistent-return */

'use strict';

const boom = require('boom');
const schemas = require('./schemas');

/**
 * Validate the "file" parameter
 *
 * @param {Object} req HTTP request object
 * @param {Object} res HTTP response object
 * @param {function} next Next function in the route
 * @param {String} param Parameter from the URL
 */

module.exports.file = (req, res, next, param) => {
    schemas.file.validate(param, (error, value) => {
        if (error) {
            return next(
                boom.boomify(error, {
                    statusCode: 400,
                    message: `Invalid "file" parameter: ${param}`,
                }),
            );
        }

        req.params.file = value;
        next();
    });
};

/**
 * Validate the "type" parameter
 *
 * @param {Object} req HTTP request object
 * @param {Object} res HTTP response object
 * @param {function} next Next function in the route
 * @param {String} param Parameter from the URL
 */

module.exports.type = (req, res, next, param) => {
    schemas.type.validate(param, (error, value) => {
        if (error) {
            return next(
                boom.boomify(error, {
                    statusCode: 404,
                    message: `Invalid "type" parameter: ${param}`,
                }),
            );
        }

        req.params.type = value;
        next();
    });
};
