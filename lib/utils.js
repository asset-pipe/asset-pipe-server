'use strict';

function booleanWithDefault(value, defaultValue) {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return defaultValue;
}

module.exports = {
    booleanWithDefault,
};
