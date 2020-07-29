'use strict';

/**
	 * Determines if object.
	 *
	 * @param {any} value The value
	 * @return {boolean} True if object, False otherwise.
	 */
const isObject = value => {
	return typeof value === 'object' && !Array.isArray(value);
};

module.exports = isObject;
