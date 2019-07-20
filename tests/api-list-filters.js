'use strict';

const assert = require('assert');

const sandbox = require('sinon').createSandbox();

const { ApiListFilters } = require('..');
const { ApiListError } = require('../lib');

describe('Api List Filters', () => {

	afterEach(() => {
		sandbox.restore();
	});

	describe('Validation', () => {

		it('Should throw if model is not found', async () => {

			const getModelInstanceFake = sandbox.stub(ApiListFilters.prototype, '_getModelInstance');
			getModelInstanceFake.throws('Model does not exist');

			const apiListFilters = new ApiListFilters();
			apiListFilters.endpoint = '/api/some-entity';
			apiListFilters.data = {};
			apiListFilters.headers = {};

			await assert.rejects(() => apiListFilters.validate(), ApiListError);
		});

		it('Should validate if model is found', async () => {

			const getModelInstanceFake = sandbox.stub(ApiListFilters.prototype, '_getModelInstance');
			getModelInstanceFake.returns({});

			const apiListFilters = new ApiListFilters();
			apiListFilters.endpoint = '/api/some-entity';
			apiListFilters.data = {};
			apiListFilters.headers = {};

			const validation = await apiListFilters.validate();

			assert.strictEqual(validation, undefined);
		});
	});

	describe('Process', () => {

		it('Should throw an internal error if getFiltersValues is not overriden', async () => {

			const getModelInstanceFake = sandbox.stub(ApiListFilters.prototype, '_getModelInstance');
			getModelInstanceFake.returns({});

			const apiListFilters = new ApiListFilters();
			apiListFilters.endpoint = '/api/some-entity';
			apiListFilters.data = {};
			apiListFilters.headers = {};

			await apiListFilters.validate();

			await assert.rejects(() => apiListFilters.process(), {
				name: 'ApiListError',
				message: 'Method getFiltersValues should be implemented in your API'
			});
		});

		it('Should throw an internal error if getFiltersValues throws', async () => {

			class MyApiListFilters extends ApiListFilters {
				async getFiltersValues() {
					throw new Error('Some custom error');
				}
			}

			const getModelInstanceFake = sandbox.stub(ApiListFilters.prototype, '_getModelInstance');
			getModelInstanceFake.returns({});

			const apiListFilters = new MyApiListFilters();
			apiListFilters.endpoint = '/api/some-entity';
			apiListFilters.data = {};
			apiListFilters.headers = {};

			await apiListFilters.validate();

			await assert.rejects(() => apiListFilters.process(), {
				name: 'ApiListError',
				message: 'Some custom error'
			});
		});

		it('Should return an object of filters if no errors occur', async () => {

			const theFilters = {
				foo: {
					options: [
						{ value: 1, title: 'Some title' },
						{ value: 2, title: 'Some other title' }
					]
				}
			};

			class MyApiListFilters extends ApiListFilters {
				async getFiltersValues() {
					return theFilters;
				}
			}

			const getModelInstanceFake = sandbox.stub(ApiListFilters.prototype, '_getModelInstance');
			getModelInstanceFake.returns({});

			const apiListFilters = new MyApiListFilters();
			apiListFilters.endpoint = '/api/some-entity';
			apiListFilters.data = {};
			apiListFilters.headers = {};

			await apiListFilters.validate();

			await apiListFilters.process();

			assert.deepStrictEqual(apiListFilters.response.body, {
				filters: theFilters
			});
		});
	});

});
