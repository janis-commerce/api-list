'use strict';

/**
 * @typedef CodesError
 * @property {Number} INVALID_REQUEST_DATA
 * @property {Number} INVALID_ENTITY
 * @property {Number} INVALID_FILTERS
 * @property {Number} INTERNAL_ERROR
 */

/**
 * @class ApiListError
 * @extends Error
 * @classdesc It is used for error handling of the APIListData class
 */
module.exports = class ApiListError extends Error {

	/**
	 * Get the error codes
	 * @returns {CodesError}
	 */
	static get codes() {

		return {
			INVALID_REQUEST_DATA: 1,
			INVALID_ENTITY: 2,
			INVALID_FILTERS: 3,
			INVALID_PARAMETERS: 4,
			INTERNAL_ERROR: 99
		};
	}

	/**
	 * @param {string} err The details of the error
	 * @param {number} code The error code
	 */
	constructor(err, code) {

		const message = err.message || err;

		super(message);
		this.message = message;
		this.code = code;
		this.name = 'ApiListError';

		if(err instanceof Error)
			this.previousError = err;
	}
};
