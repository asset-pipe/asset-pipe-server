'use strict';

const schemas = require('./schemas');
const boom = require('boom');

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
                })
            );
        }

        req.params.file = value;
        next();
    });
};
