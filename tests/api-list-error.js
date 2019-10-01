'use strict';

const assert = require('assert');

const { ApiListError } = require('../lib');

describe('Api Session Error', () => {

	it('Should accept a message error and a code', () => {
		const error = new ApiListError('Some error', ApiListError.codes.INVALID_REQUEST_DATA);

		assert.strictEqual(error.message, 'Some error');
		assert.strictEqual(error.code, ApiListError.codes.INVALID_REQUEST_DATA);
		assert.strictEqual(error.name, 'ApiListError');
	});

	it('Should accept an error instance and a code', () => {

		const previousError = new Error('Some error');

		const error = new ApiListError(previousError, ApiListError.codes.INVALID_REQUEST_DATA);

		assert.strictEqual(error.message, 'Some error');
		assert.strictEqual(error.code, ApiListError.codes.INVALID_REQUEST_DATA);
		assert.strictEqual(error.name, 'ApiListError');
		assert.strictEqual(error.previousError, previousError);
	});
});
