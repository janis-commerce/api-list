'use strict';

class ApiListError extends Error {

	static get codes() {

		return {
			INVALID_REQUEST_DATA: 1,
			INVALID_ENTITY: 2,
			INVALID_FILTERS: 3,
			INTERNAL_ERROR: 99
		};
	}

	constructor(err, code) {

		const message = err.message || err;

		super(message);
		this.message = message;
		this.code = code;
		this.name = 'ApiListError';

		if(err instanceof Error)
			this.previousError = err;
	}
}

module.exports = ApiListError;
