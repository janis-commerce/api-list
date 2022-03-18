'use strict';

module.exports = object => object && !Array.isArray(object) && typeof object === 'object';
