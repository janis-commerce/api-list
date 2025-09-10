/* eslint-disable max-classes-per-file */

'use strict';

const assert = require('assert');
const path = require('path');

const sinon = require('sinon');
const mockRequire = require('mock-require');

const Model = require('@janiscommerce/model');

const { ApiListData } = require('..');
const { ApiListError } = require('../lib');
const { searchMapper, booleanMapper, customTypeMapper } = require('../lib/filter-mappers');

describe('Api List Data', () => {

	class MyModel extends Model {}

	const modelPath = path.join(process.cwd(), '', 'models', 'some-entity');
	const modelPathWithMsPath = path.join(process.cwd(), 'src', 'models', 'entity-in-src-path');

	let env;

	beforeEach(() => {
		env = { ...process.env };
	});

	afterEach(() => {
		process.env = env;
	});

	beforeEach(() => {
		mockRequire(modelPath, MyModel);
		mockRequire(modelPathWithMsPath, MyModel);
	});

	afterEach(() => {
		mockRequire.stopAll();
		sinon.restore();
	});

	const defaultGetParams = {
		page: 1,
		limit: 60
	};

	const assertGet = params => {
		sinon.assert.calledOnceWithExactly(MyModel.prototype.get, {
			...defaultGetParams, // default param, can be changed sending page or limit in params
			...params
		});
	};

	const getApiInstance = (ApiClass, { endpoint, headers, data, session } = {}) => {

		const apiInstance = new ApiClass();

		apiInstance.endpoint = endpoint || 'some-entity';
		apiInstance.headers = headers || {};
		apiInstance.data = data || {};

		if(session)
			apiInstance.session = session;

		return apiInstance;
	};

	describe('Validation', () => {

		beforeEach(() => {
			process.env.MS_PATH = '';
		});

		it('Should throw if endpoint is not a valid rest endpoint', async () => {

			const myApiList = getApiInstance(ApiListData, {
				endpoint: '/'
			});

			await assert.rejects(() => myApiList.validate(), ApiListError);
		});

		it('Should throw if model is not found', async () => {

			const myApiList = getApiInstance(ApiListData, {
				endpoint: 'some-other-entity'
			});

			await assert.rejects(() => myApiList.validate(), ApiListError);
		});

		it('Should validate if no data is passed', async () => {

			const myApiList = getApiInstance(ApiListData);

			const validation = await myApiList.validate();

			assert.strictEqual(validation, undefined);
		});

		it('Shouldn\'t throw because of unknown headers', async () => {

			const myApiList = getApiInstance(ApiListData, {
				headers: { 'x-foo': 'bar' }
			});

			const validation = await myApiList.validate();

			assert.strictEqual(validation, undefined);
		});

		it('Should set default values if no data is passed', async () => {

			const myApiList = getApiInstance(ApiListData);

			const validation = await myApiList.validate();

			assert.strictEqual(validation, undefined);

			assert.deepStrictEqual(myApiList.dataWithDefaults, {});
			assert.deepStrictEqual(myApiList.headersWithDefaults, {
				'x-janis-page': 1,
				'x-janis-page-size': 60,
				'x-janis-totals': false,
				'x-janis-only-totals': false,
				'x-janis-only-params': false
			});
		});

		it('Should set default sort direction if only sort field is passed', async () => {

			class MyApiList extends ApiListData {
				get sortableFields() {
					return ['id'];
				}
			}

			const myApiList = getApiInstance(MyApiList);

			const validation = await myApiList.validate();

			assert.strictEqual(validation, undefined);

			assert.deepStrictEqual(myApiList.dataWithDefaults, {});
			assert.deepStrictEqual(myApiList.headersWithDefaults, {
				'x-janis-page': 1,
				'x-janis-page-size': 60,
				'x-janis-totals': false,
				'x-janis-only-totals': false,
				'x-janis-only-params': false
			});
		});

		it('Should return the limit and page as integers when headers are integers', async () => {

			const myApiList = getApiInstance(ApiListData, {
				headers: {
					'x-janis-page': 1,
					'x-janis-page-size': 60
				}
			});

			const validation = await myApiList.validate();

			assert.strictEqual(validation, undefined);

			assert.deepStrictEqual(myApiList.dataWithDefaults, {});
			assert.deepStrictEqual(myApiList.paging.getParams(myApiList.headersWithDefaults), defaultGetParams);
		});

		it('Should return the limit and page as integers when headers are strings', async () => {

			const myApiList = getApiInstance(ApiListData, {
				headers: {
					'x-janis-page': '1',
					'x-janis-page-size': '60'
				}
			});

			const validation = await myApiList.validate();

			assert.strictEqual(validation, undefined);

			assert.deepStrictEqual(myApiList.dataWithDefaults, {});
			assert.deepStrictEqual(myApiList.paging.getParams(myApiList.headersWithDefaults), defaultGetParams);
		});

		it('Should throw if page header is invalid strings', async () => {

			const myApiList = getApiInstance(ApiListData, {
				headers: { 'x-janis-page': '1page' }
			});

			await assert.rejects(() => myApiList.validate(), err => {
				return err instanceof ApiListError
					&& !!err.message.includes('x-janis-page')
					&& !!err.message.includes('1page');
			});
		});

		it('Should throw if page size header is invalid strings', async () => {

			const myApiList = getApiInstance(ApiListData, {
				headers: { 'x-janis-page-size': '60pages' }
			});

			await assert.rejects(() => myApiList.validate(), err => {
				return err instanceof ApiListError
					&& !!err.message.includes('x-janis-page-size')
					&& !!err.message.includes('60pages');
			});
		});

		it('Should throw if sort field is passed and there are no sortable fields', async () => {

			const myApiList = getApiInstance(ApiListData, {
				data: { sortBy: 'id' }
			});

			await assert.rejects(() => myApiList.validate(), err => {
				return err instanceof ApiListError
					&& !!err.message.includes('sortBy')
					&& !!err.message.includes('id')
					&& !!err.message.includes('undefined');
			});
		});

		it('Should throw if invalid sort field is passed', async () => {

			class MyApiList extends ApiListData {
				get sortableFields() {
					return ['id'];
				}
			}

			const myApiList = getApiInstance(MyApiList, {
				data: { sortBy: 'invalidField' }
			});

			await assert.rejects(() => myApiList.validate(), err => {
				return err instanceof ApiListError
					&& !!err.message.includes('sortBy')
					&& !!err.message.includes('invalidField');
			});
		});

		it('Should throw if invalid sort direction is passed', async () => {

			class MyApiList extends ApiListData {
				get sortableFields() {
					return ['id'];
				}
			}

			const myApiList = getApiInstance(MyApiList, {
				data: { sortBy: 'id', sortDirection: 'unknownValue' }
			});

			await assert.rejects(() => myApiList.validate(), err => {
				return err instanceof ApiListError
					&& !!err.message.includes('sortDirection')
					&& !!err.message.includes('unknownValue');
			});
		});

		it('Should throw if invalid page is passed', async () => {

			const myApiList = getApiInstance(ApiListData, {
				headers: { 'x-janis-page': -10 }
			});

			await assert.rejects(() => myApiList.validate(), err => {
				return err instanceof ApiListError
					&& !!err.message.includes('x-janis-page')
					&& !!err.message.includes('-10');
			});
		});

		it('Should throw if invalid page size is passed', async () => {

			const myApiList = getApiInstance(ApiListData, {
				headers: { 'x-janis-page-size': -10 }
			});

			await assert.rejects(() => myApiList.validate(), err => {
				return err instanceof ApiListError
					&& !!err.message.includes('x-janis-page-size')
					&& !!err.message.includes('-10');
			});
		});

		it('Should throw if a page size grater than the max size is passed', async () => {

			const myApiList = getApiInstance(ApiListData, {
				headers: { 'x-janis-page-size': 500 }
			});

			await assert.rejects(() => myApiList.validate(), err => {
				return err instanceof ApiListError
					&& !!err.message.includes('x-janis-page-size')
					&& !!err.message.includes('500');
			});
		});

		it('Should throw if a page size grater than the max size for Services is passed', async () => {

			const myApiList = getApiInstance(ApiListData, {
				session: { isService: true },
				headers: { 'x-janis-page-size': 1001 }
			});

			await assert.rejects(() => myApiList.validate(), err => {
				return err instanceof ApiListError
					&& !!err.message.includes('x-janis-page-size')
					&& !!err.message.includes('1001');
			});
		});

		it('Should throw if available-filter is invalid', async () => {

			class InvalidListApi extends ApiListData {

				get availableFilters() {
					return 'invalid';
				}
			}

			const myApiList = getApiInstance(InvalidListApi, {
				data: {
					filters: {
						invalid: 'bar'
					}
				}
			});

			await assert.rejects(() => myApiList.validate(), { name: ApiListError.name, code: ApiListError.codes.INVALID_FILTERS });
		});

		it('Should throw if search-filter is invalid', async () => {

			class InvalidListApi extends ApiListData {

				get searchFilters() {
					return 'invalid';
				}
			}

			const myApiList = getApiInstance(InvalidListApi, {
				data: {
					filters: {
						invalid: 'bar'
					}
				}
			});

			await assert.rejects(() => myApiList.validate(), { name: ApiListError.name, code: ApiListError.codes.INVALID_FILTERS });
		});

		it('Should throw if static-filter is invalid', async () => {

			class InvalidListApi extends ApiListData {

				get staticFilters() {
					return 'invalid';
				}
			}

			const myApiList = getApiInstance(InvalidListApi, {
				data: {
					filters: {
						invalid: 'bar'
					}
				}
			});

			await assert.rejects(() => myApiList.validate(), { name: ApiListError.name, code: ApiListError.codes.INVALID_FILTERS });
		});

		it('Should throw if filter is passed and there are no available filters', async () => {

			const myApiList = getApiInstance(ApiListData, {
				data: {
					filters: {
						foo: 'bar'
					}
				}
			});

			await assert.rejects(() => myApiList.validate(), err => {
				return err instanceof ApiListError
					&& !!err.message.includes('filters')
					&& !!err.message.includes('undefined');
			});
		});

		it('Should throw if search filter is passed and there are no search filters', async () => {

			const myApiList = getApiInstance(ApiListData, {
				data: {
					filters: {
						search: 'bar'
					}
				}
			});

			await assert.rejects(() => myApiList.validate(), err => {
				return err instanceof ApiListError
					&& !!err.message.includes('filters')
					&& !!err.message.includes('undefined');
			});
		});

		it('Should throw if unknown filter is passed', async () => {

			class MyApiList extends ApiListData {
				get availableFilters() {
					return ['id'];
				}
			}

			const myApiList = getApiInstance(MyApiList, {
				data: {
					filters: {
						foo: 'bar'
					}
				}
			});

			await assert.rejects(() => myApiList.validate(), err => {
				return err instanceof ApiListError
					&& !!err.message.includes('filters')
					&& !!err.message.includes('filters.foo');
			});
		});

		context('When pass custom parameters', () => {

			it('Should throw if custom parameter is invalid', async () => {

				class InvalidListApi extends ApiListData {

					get customParameters() {
						return true;
					}
				}

				const myApiList = getApiInstance(InvalidListApi, {
					data: { invalid: false }
				});

				await assert.rejects(myApiList.validate(), {
					name: ApiListError.name,
					code: ApiListError.codes.INVALID_PARAMETERS
				});
			});

			it('Should throw if invalid custom parameter is passed', async () => {

				class MyApiList extends ApiListData {

					get customParameters() {
						return ['fooData'];
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					data: { invalid: 'bar' }
				});

				await assert.rejects(() => myApiList.validate(), err => {
					return err instanceof ApiListError
						&& !!err.message.includes('invalid');
				});
			});

			it('Should throw if custom parameter is not of the defined type', async () => {

				class MyApiList extends ApiListData {
					get customParameters() {
						return [{ foo: 'string' }];
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					data: { foo: true }
				});

				await assert.rejects(() => myApiList.validate(), err => {
					return err instanceof ApiListError
					&& !!err.message.includes('foo');
				});
			});

			it('Should throw if custom parameter include reserved words', async () => {

				class MyApiList extends ApiListData {
					get customParameters() {
						return [
							{
								name: 'filters',
								valueMapper: Number
							}
						];
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					data: { filters: 1 }
				});

				await assert.rejects(() => myApiList.validate(), {
					message: 'The custom parameter name "filters" is a reserved parameter name.'
				});
			});

			it('Should validate if valid data is passed', async () => {

				class MyApiList extends ApiListData {

					get searchFilters() {
						return ['id', 'foo'];
					}

					get availableFilters() {
						return [
							'id',
							{
								name: 'id2',
								valueMapper: Number
							}
						];
					}

					get sortableFields() {
						return ['foo'];
					}

					get customParameters() {
						return [
							'id',
							{
								name: 'fooData',
								valueMapper: Boolean
							}];
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					data: {
						filters: {
							id: '10',
							id2: '100',
							search: '1000'
						},
						sortBy: 'foo',
						sortDirection: 'asc',
						id: '10',
						fooData: true
					},
					headers: {
						'x-janis-page': '3',
						'x-janis-page-size': '20'
					}
				});

				const validation = await myApiList.validate();

				assert.strictEqual(validation, undefined);
			});

			it('should validate when more than one custom parameter is passed', async () => {

				class MyApiList extends ApiListData {

					get customParameters() {
						return [{
							name: 'fooData',
							valueMapper: Boolean
						}, {
							name: 'barData',
							valueMapper: Boolean
						}];
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					data: {
						fooData: true,
						barData: false
					},
					headers: {
						'x-janis-page': '3',
						'x-janis-page-size': '20'
					}
				});

				const validation = await myApiList.validate();

				assert.strictEqual(validation, undefined);
			});
		});

		context('When pass sortBy as array', () => {

			it('Should validate if sortBy property is passed', async () => {

				class MyApiList extends ApiListData {

					get sortableFields() {
						return ['foo', 'bar'];
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					data: {
						sortBy: ['foo', 'bar']
					}
				});

				const validation = await myApiList.validate();

				assert.strictEqual(validation, undefined);
			});

			it('Should throw if invalid sort field is passed', async () => {

				class MyApiList extends ApiListData {

					get sortableFields() {
						return ['foo', 'bar'];
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					data: {
						sortBy: ['foo', 'invalidField']
					}
				});

				await assert.rejects(() => myApiList.validate(), err => {
					return err instanceof ApiListError
						&& !!err.message.includes('sortBy')
						&& !!err.message.includes('invalidField');
				});
			});

			it('Should throw if the length of the sort field is greater than the maximum allowed', async () => {

				class MyApiList extends ApiListData {

					get sortableFields() {
						return ['foo', 'bar'];
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					data: {
						sortBy: ['foo', 'bar', 'bar', 'foo']
					}
				});

				await assert.rejects(() => myApiList.validate(), err => {
					return err instanceof ApiListError
						&& !!err.message.includes('Maximum amount of field to sort is');
				});
			});
		});

		context('When sortDirection is passed as array', () => {

			it('Should validate if sortDirection is passed', async () => {

				class MyApiList extends ApiListData {

					get sortableFields() {
						return ['foo', 'bar'];
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					data: {
						sortBy: ['foo', 'bar'],
						sortDirection: ['asc', 'desc']
					}
				});

				const validation = await myApiList.validate();

				assert.strictEqual(validation, undefined);
			});

			it('Should validate if sortDirection is passed that contains undefined', async () => {

				class MyApiList extends ApiListData {

					get sortableFields() {
						return ['foo', 'bar'];
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					data: {
						sortBy: ['foo', 'bar'],
						sortDirection: [undefined, 'desc']
					}
				});

				const validation = await myApiList.validate();

				assert.strictEqual(validation, undefined);
			});

			it('Should throw if invalid sort field is passed', async () => {

				class MyApiList extends ApiListData {

					get sortableFields() {
						return ['foo', 'bar'];
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					data: {
						sortDirection: ['invalidDirection']
					}
				});

				await assert.rejects(() => myApiList.validate(), err => {
					return err instanceof ApiListError
						&& !!err.message.includes('sortDirection')
						&& !!err.message.includes('invalidDirection');
				});
			});

			it('Should validate if the sort field is string', async () => {

				class MyApiList extends ApiListData {

					get sortableFields() {
						return ['foo', 'bar'];
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					data: {
						sortBy: 'foo',
						sortDirection: ['desc']
					}
				});

				const validation = await myApiList.validate();

				assert.strictEqual(validation, undefined);
			});
		});
	});

	describe('Validation with MS_PATH', () => {

		beforeEach(() => {
			process.env.MS_PATH = 'src';
		});

		it('Should validate if valid data is passed', async () => {

			const myApiList = getApiInstance(ApiListData, {
				endpoint: '/entity-in-src-path'
			});

			await assert.doesNotReject(myApiList.validate());
		});
	});

	describe('Process', () => {

		beforeEach(() => {
			process.env.MS_PATH = '';
		});

		it('Should throw an internal error if get fails', async () => {

			sinon.stub(MyModel.prototype, 'get')
				.rejects('Some internal error');

			const myApiList = getApiInstance(ApiListData);

			await myApiList.validate();

			await assert.rejects(() => myApiList.process());

			assertGet();
		});

		it('Should pass the default parameters to the model get', async () => {

			sinon.stub(MyModel.prototype, 'get')
				.resolves([]);

			const myApiList = getApiInstance(ApiListData);

			await myApiList.validate();

			await myApiList.process();

			assertGet();
		});

		it('Should pass client defined parameters to the model get', async () => {

			sinon.stub(MyModel.prototype, 'get')
				.resolves([]);

			class MyApiList extends ApiListData {

				get availableFilters() {
					return [
						'id',
						{
							name: 'id2',
							valueMapper: Number
						}
					];
				}

				get sortableFields() {
					return ['foo'];
				}
			}

			const myApiList = getApiInstance(MyApiList, {
				data: {
					sortBy: 'foo',
					sortDirection: 'DESC',
					filters: {
						id: '10',
						id2: '100'
					}
				},
				headers: {
					'x-janis-page': 2,
					'x-janis-page-size': 20
				}
			});

			await myApiList.validate();

			await myApiList.process();

			assertGet({
				page: 2,
				limit: 20,
				order: {
					foo: 'desc'
				},
				filters: {
					id: '10',
					id2: 100
				}
			});
		});

		context('When pass sortDirection as array', () => {

			it('Should pass client defined parameters to the model get and set the first index to field', async () => {

				sinon.stub(MyModel.prototype, 'get')
					.resolves([]);

				class MyApiList extends ApiListData {
					get sortableFields() {
						return ['foo'];
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					data: {
						sortBy: 'foo',
						sortDirection: ['desc']
					}
				});

				await myApiList.validate();

				await myApiList.process();

				assertGet({
					order: { foo: 'desc' }
				});
			});

			it('Should pass client defined parameters to the model get and set the default value to field if the first index is undefined', async () => {

				sinon.stub(MyModel.prototype, 'get')
					.resolves([]);

				class MyApiList extends ApiListData {
					get sortableFields() {
						return ['foo'];
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					data: {
						sortBy: 'foo',
						sortDirection: [undefined, 'desc']
					}
				});

				await myApiList.validate();

				await myApiList.process();

				assertGet({ order: { foo: 'asc' } });
			});
		});

		context('When pass sort field as array', () => {

			it('Should pass client defined parameters to the model get and set default sort direction', async () => {

				sinon.stub(MyModel.prototype, 'get')
					.resolves([]);

				class MyApiList extends ApiListData {
					get sortableFields() {
						return ['foo', 'bar'];
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					data: {
						sortBy: ['foo', 'bar']
					}
				});

				await myApiList.validate();

				await myApiList.process();

				assertGet({
					order: {
						foo: 'asc',
						bar: 'asc'
					}
				});
			});

			it('Should pass client defined parameters to the model get and set different sort direction to each one', async () => {

				sinon.stub(MyModel.prototype, 'get')
					.resolves([]);

				class MyApiList extends ApiListData {
					get sortableFields() {
						return ['foo', 'bar'];
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					data: {
						sortBy: ['foo', 'bar'],
						sortDirection: ['asc', 'DESC']
					}
				});

				await myApiList.validate();

				await myApiList.process();

				assertGet({
					order: {
						foo: 'asc',
						bar: 'desc'
					}
				});
			});

			it('Should pass client defined parameters to the model get and set default sort direction if pass undefined', async () => {

				sinon.stub(MyModel.prototype, 'get')
					.resolves([]);

				class MyApiList extends ApiListData {
					get sortableFields() {
						return ['foo', 'bar'];
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					data: {
						sortBy: ['foo', 'bar'],
						sortDirection: [undefined, 'DESC']
					}
				});

				await myApiList.validate();

				await myApiList.process();

				assertGet({
					order: {
						foo: 'asc',
						bar: 'desc'
					}
				});
			});

			it('Should pass client defined parameters to the model get and set sort direction if pass a string', async () => {

				sinon.stub(MyModel.prototype, 'get')
					.resolves([]);

				class MyApiList extends ApiListData {
					get sortableFields() {
						return ['foo', 'bar'];
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					data: {
						sortBy: ['foo', 'bar'],
						sortDirection: 'desc'
					}
				});

				await myApiList.validate();

				await myApiList.process();

				assertGet({
					order: {
						foo: 'desc',
						bar: 'desc'
					}
				});
			});

			it('Should pass client defined parameters to the model get if pass sort field as empty array', async () => {

				sinon.stub(MyModel.prototype, 'get')
					.resolves([]);

				class MyApiList extends ApiListData {
					get sortableFields() {
						return ['foo', 'bar'];
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					data: { sortBy: [] }
				});

				await myApiList.validate();

				await myApiList.process();

				assertGet();
			});
		});

		context('When use sortableFields with objects', () => {

			it('Should pass client defined parameters to the model get and not pass sort fields if sortableFields has invalid valueMapper', async () => {

				sinon.stub(MyModel.prototype, 'get')
					.resolves([]);

				class MyApiList extends ApiListData {
					get sortableFields() {
						return [
							{ name: 'bar1', valueMapper: () => {} },
							{ name: 'bar2', valueMapper: () => [null] },
							{ name: 'bar3', valueMapper: () => [[{}]] }
						];
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					data: {
						sortBy: ['bar1', 'bar2', 'bar3']
					}
				});

				await myApiList.validate();

				await myApiList.process();

				assertGet();
			});

			it('Should pass client defined parameters to the model get with sort fields passed with sort direction by default', async () => {

				sinon.stub(MyModel.prototype, 'get')
					.resolves([]);

				class MyApiList extends ApiListData {
					get sortableFields() {
						return [{ name: 'foo' }, 'bar'];
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					data: {
						sortBy: ['foo', 'bar']
					}
				});

				await myApiList.validate();

				await myApiList.process();

				assertGet({
					order: {
						foo: 'asc',
						bar: 'asc'
					}
				});
			});

			it('Should pass client defined parameters to the model get with sort fields passed modified with sort direction by default', async () => {

				sinon.stub(MyModel.prototype, 'get')
					.resolves([]);

				class MyApiList extends ApiListData {
					get sortableFields() {
						return [{ name: 'foo', valueMapper: () => [['test']] }, 'bar'];
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					data: {
						sortBy: ['foo', 'bar']
					}
				});

				await myApiList.validate();

				await myApiList.process();

				assertGet({
					order: {
						test: 'asc',
						bar: 'asc'
					}
				});
			});

			it('Should pass client defined parameters to the model get with sort fields and sort directions passed', async () => {

				sinon.stub(MyModel.prototype, 'get')
					.resolves([]);

				class MyApiList extends ApiListData {
					get sortableFields() {
						return [{ name: 'foo', valueMapper: () => [['test', 'asc'], ['test2']] }, 'bar'];
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					data: {
						sortBy: ['foo', 'bar'],
						sortDirection: ['desc', 'desc']
					}
				});

				await myApiList.validate();

				await myApiList.process();

				assertGet({
					order: {
						test: 'asc',
						test2: 'desc',
						bar: 'desc'
					}
				});
			});

			it('Should pass client defined parameters to the model get with sort fields and sort directions modified', async () => {

				sinon.stub(MyModel.prototype, 'get')
					.resolves([]);

				class MyApiList extends ApiListData {
					get sortableFields() {
						return [
							{
								name: 'foo',
								valueMapper: direction => {
									return direction === 'asc' ? [['test', 'asc'], ['test2', 'desc']] : [['test', 'desc'], ['test2', 'asc']];
								}
							},
							'bar'
						];
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					data: {
						sortBy: ['foo', 'bar'],
						sortDirection: ['desc', 'desc']
					}
				});

				await myApiList.validate();

				await myApiList.process();

				assertGet({
					order: {
						test: 'desc',
						test2: 'asc',
						bar: 'desc'
					}
				});
			});
		});

		it('Should pass client defined parameters to the model get when it receives an array to filter with ', async () => {

			sinon.stub(MyModel.prototype, 'get')
				.resolves([]);

			class MyApiList extends ApiListData {

				get availableFilters() {
					return [
						'id',
						{
							name: 'name',
							valueMapper: value => value.toUpperCase()
						},
						{
							name: 'country',
							valueMapper: searchMapper
						},
						{
							name: 'isDefault',
							valueMapper: booleanMapper
						},
						{
							name: 'age',
							valueMapper: customTypeMapper('notEqual')
						}
					];
				}

				get customParameters() {
					return [{
						name: 'ageData',
						valueMapper: customTypeMapper('notEqual')
					}];
				}
			}

			const myApiList = getApiInstance(MyApiList, {
				data: {
					filters: {
						id: '10',
						name: ['foo', 'bar'],
						country: ['arge', 'bras'],
						isDefault: [1, 0],
						age: [18, 30]
					},
					ageData: [18, 30]
				}
			});

			await myApiList.validate();

			await myApiList.process();

			assertGet({
				filters: {
					id: '10',
					name: ['FOO', 'BAR'],
					country: { type: 'search', value: ['arge', 'bras'] },
					isDefault: [true, false],
					age: { type: 'notEqual', value: [18, 30] }
				}
			});
		});

		it('Should pass endpoint parents to the model get as filters', async () => {

			sinon.stub(MyModel.prototype, 'get')
				.resolves([]);

			class MyApiList extends ApiListData {

				get availableFilters() {
					return [
						'id',
						{
							name: 'id2',
							valueMapper: Number
						},
						{
							name: 'someParent',
							valueMapper: Number
						},
						{
							name: 'hasSubProperty',
							internalName: (filterConfiguration, mappedValue, originalValue) => `rootProperty.${originalValue}`,
							valueMapper: () => true
						}
					];
				}

				get sortableFields() {
					return ['foo'];
				}
			}

			const myApiList = getApiInstance(MyApiList, {
				endpoint: '/some-parent/1/some-entity',
				data: {
					sortBy: 'foo',
					sortDirection: 'DESC',
					filters: {
						id: '10',
						id2: '100',
						hasSubProperty: 'myProp'
					}
				}
			});

			await myApiList.validate();

			await myApiList.process();

			assertGet({
				order: {
					foo: 'desc'
				},
				filters: {
					id: '10',
					id2: 100,
					someParent: 1,
					'rootProperty.myProp': true
				}
			});
		});

		describe('session', () => {

			it('Should use regular model when there is no session in API', async () => {

				sinon.stub(MyModel.prototype, 'get')
					.resolves([]);

				const myApiList = getApiInstance(ApiListData);

				await myApiList.validate();

				await myApiList.process();

				assertGet();

				assert.deepStrictEqual(myApiList.model.session, undefined);
			});

			it('Should use injected model when API has a session', async () => {

				sinon.stub(MyModel.prototype, 'get')
					.resolves([]);

				class MyApiList extends ApiListData {}

				const sessionMock = {
					getSessionInstance: sinon.fake(() => {
						const modelInstance = new MyModel();
						modelInstance.session = sessionMock;

						return modelInstance;
					})
				};

				const myApiList = getApiInstance(MyApiList, {
					session: sessionMock
				});

				await myApiList.validate();

				await myApiList.process();

				assertGet();

				sinon.assert.calledOnceWithExactly(sessionMock.getSessionInstance, MyModel);
			});
		});

		it('Should return an empty rows array', async () => {

			sinon.stub(MyModel.prototype, 'get')
				.resolves([]);

			const myApiList = getApiInstance(ApiListData);

			await myApiList.validate();

			await myApiList.process();

			assert.deepStrictEqual(myApiList.response.body, []);

			assertGet();
		});

		it('Should return a rows array and total rows if passed params do find results', async () => {

			const row = { foo: 'bar' };
			const results = new Array(60).fill(row);

			sinon.stub(MyModel.prototype, 'get')
				.resolves(results);

			sinon.stub(MyModel.prototype, 'getTotals')
				.resolves({ total: 100 });

			const myApiList = getApiInstance(ApiListData, { headers: { 'x-janis-totals': true } });

			await myApiList.validate();

			await myApiList.process();

			assert.deepStrictEqual(myApiList.response.body, results);
			assert.deepStrictEqual(myApiList.response.headers, { 'x-janis-total': 100 });

			assertGet();

			sinon.assert.calledOnceWithExactly(MyModel.prototype.getTotals, {}, undefined);
		});

		it('Should return a rows array (formatted) and total rows if passed params do find results', async () => {

			const row = { foo: 'bar' };
			const results = new Array(60).fill(row);
			const formattedRow = { foo: 'bar', moreFoo: true };
			const formattedResults = new Array(60).fill(formattedRow);

			sinon.stub(MyModel.prototype, 'get')
				.resolves(results);

			sinon.stub(MyModel.prototype, 'getTotals')
				.resolves({ total: 100 });

			class MyApiList extends ApiListData {

				formatRows(rows) {
					return rows.map(r => ({ ...r, moreFoo: true }));
				}
			}

			const myApiList = getApiInstance(MyApiList, { headers: { 'x-janis-totals': true } });

			await myApiList.validate();

			await myApiList.process();

			assert.deepStrictEqual(myApiList.response.body, formattedResults);

			assert.deepStrictEqual(myApiList.response.headers, {
				'x-janis-total': 100
			});

			assertGet();

			sinon.assert.calledOnceWithExactly(MyModel.prototype.getTotals, {}, undefined);
		});

		describe('searchFilters', () => {

			beforeEach(() => {
				sinon.stub(MyModel.prototype, 'get')
					.resolves([]);
			});

			it('Should format search filter with a single field', async () => {

				class MyApiList extends ApiListData {

					get searchFilters() {
						return ['id'];
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					data: {
						filters: {
							search: 'some-id'
						}
					}
				});

				await myApiList.validate();

				await myApiList.process();

				assertGet({
					filters: {
						id: { type: 'search', value: 'some-id' }
					}
				});
			});

			it('Should format search filter with multiple field with OR filters', async () => {

				class MyApiList extends ApiListData {

					get searchFilters() {
						return ['id', 'foo', 'bar'];
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					data: {
						filters: {
							search: 'some-id'
						}
					}
				});

				await myApiList.validate();

				await myApiList.process();

				assertGet({
					filters: [
						{ id: { type: 'search', value: 'some-id' } },
						{ foo: { type: 'search', value: 'some-id' } },
						{ bar: { type: 'search', value: 'some-id' } }
					]
				});
			});

			it('Should format search filter with multiple words in data request', async () => {

				class MyApiList extends ApiListData {

					get searchFilters() {
						return ['id', 'foo', 'bar'];
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					data: {
						filters: {
							search: 'some-id some-foo'
						}
					}
				});

				await myApiList.validate();

				await myApiList.process();

				assertGet({
					filters: [
						{ id: { type: 'search', value: 'some-id' } },
						{ id: { type: 'search', value: 'some-foo' } },
						{ foo: { type: 'search', value: 'some-id' } },
						{ foo: { type: 'search', value: 'some-foo' } },
						{ bar: { type: 'search', value: 'some-id' } },
						{ bar: { type: 'search', value: 'some-foo' } }
					]
				});
			});

			it('Should combine search filter with availableFilters', async () => {

				class MyApiList extends ApiListData {

					get availableFilters() {
						return [
							'other'
						];
					}

					get searchFilters() {
						return ['id', 'foo', 'bar'];
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					data: {
						filters: {
							search: 'some-id',
							other: 'something'
						}
					}
				});

				await myApiList.validate();

				await myApiList.process();

				assertGet({
					filters: [
						{ id: { type: 'search', value: 'some-id' }, other: 'something' },
						{ foo: { type: 'search', value: 'some-id' }, other: 'something' },
						{ bar: { type: 'search', value: 'some-id' }, other: 'something' }
					]
				});
			});
		});

		describe('staticFilters', () => {

			beforeEach(() => {
				sinon.stub(MyModel.prototype, 'get')
					.resolves([]);
			});

			it('Should use only static filter', async () => {

				class MyApiList extends ApiListData {

					get staticFilters() {
						return {
							foo: 1,
							bar: 2
						};
					}
				}

				const myApiList = getApiInstance(MyApiList);

				await myApiList.validate();

				await myApiList.process();

				assertGet({
					filters: {
						foo: 1,
						bar: 2
					}
				});
			});

			it('Should combine static filter with availableFilters', async () => {

				class MyApiList extends ApiListData {

					get availableFilters() {
						return [
							'other'
						];
					}

					get staticFilters() {
						return {
							foo: 1,
							bar: 2
						};
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					data: {
						filters: {
							other: 'something'
						}
					}
				});

				await myApiList.validate();

				await myApiList.process();

				assertGet({
					filters: {
						foo: 1,
						bar: 2,
						other: 'something'
					}
				});
			});

			it('Should combine static, search filter with availableFilters', async () => {

				class MyApiList extends ApiListData {

					get availableFilters() {
						return [
							'other'
						];
					}

					get searchFilters() {
						return [
							'some',
							'another'
						];
					}

					get staticFilters() {
						return {
							foo: 1,
							bar: 2
						};
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					data: {
						filters: {
							other: 'something',
							search: 'secret'
						}
					}
				});

				await myApiList.validate();

				await myApiList.process();

				assertGet({
					filters: [
						{ some: { type: 'search', value: 'secret' }, foo: 1, bar: 2, other: 'something' },
						{ another: { type: 'search', value: 'secret' }, foo: 1, bar: 2, other: 'something' }
					]
				});
			});
		});

		context('When using a custom model name', () => {

			it('Should use custom model-name for making the query', async () => {

				class CustomModel extends Model {}

				const customModelPath = path.join(process.cwd(), '', 'models', 'custom-entity');

				mockRequire(customModelPath, CustomModel);

				sinon.stub(CustomModel.prototype, 'get')
					.resolves([]);

				class MyApiList extends ApiListData {

					get modelName() {
						return 'custom-entity';
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					endpoint: '/custom-entity'
				});

				await myApiList.validate();

				await myApiList.process();

				sinon.assert.calledOnceWithExactly(CustomModel.prototype.get, defaultGetParams);

				assert.deepStrictEqual(myApiList.model.session, undefined);
			});
		});

		describe('formatFilters', () => {

			beforeEach(() => {
				sinon.stub(MyModel.prototype, 'get')
					.resolves([]);
			});

			it('Should use formatFilters method and modify a filter', async () => {

				class MyApiList extends ApiListData {

					get availableFilters() {
						return [
							'someQuantityFilter',
							'otherFilter'
						];
					}

					formatFilters(filters) {

						if(filters.someQuantityFilter && filters.someQuantityFilter > 100) {
							return {
								...filters,
								someQuantityFilter: 100
							};
						}

						return filters;
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					data: {
						filters: {
							someQuantityFilter: 150,
							otherFilter: 'something'
						}
					}
				});

				await myApiList.validate();

				await myApiList.process();

				assertGet({
					filters: {
						someQuantityFilter: 100,
						otherFilter: 'something'
					}
				});
			});

			it('Should use formatFilters method and override the filters', async () => {

				class MyApiList extends ApiListData {

					get availableFilters() {
						return [
							'someQuantityFilter',
							'otherFilter'
						];
					}

					formatFilters() {
						return { foo: 'bar' };
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					filters: {
						someQuantityFilter: 150,
						otherFilter: 'something'
					}
				});

				await myApiList.validate();

				await myApiList.process();

				assertGet({
					filters: { foo: 'bar' }
				});
			});

			it('Should use formatFilters method and don\'t modify the filters', async () => {

				class MyApiList extends ApiListData {

					get availableFilters() {
						return [
							'someQuantityFilter',
							'otherFilter'
						];
					}

					formatFilters(filters) {

						if(!filters)
							return filters;

						if(filters.someQuantityFilter && filters.someQuantityFilter > 100) {
							return {
								...filters,
								someQuantityFilter: 100
							};
						}

						return filters;
					}
				}

				const myApiList = getApiInstance(MyApiList);

				await myApiList.validate();

				await myApiList.process();

				assertGet();
			});
		});

		it('Should not send empty filters', async () => {

			const fakeDate = '2022-04-21T21:28:45.856Z';

			sinon.stub(MyModel.prototype, 'get')
				.resolves([]);

			class MyApiList extends ApiListData {

				get availableFilters() {
					return [
						'id',
						{
							name: 'myDateRange',
							internalName: 'myDateRangeStartFrom',
							valueMapper: ({ from }) => from
						},
						{
							name: 'myDateRange',
							internalName: 'myDateRangeEndTo',
							valueMapper: ({ to }) => to
						}
					];
				}
			}

			const myApiList = getApiInstance(MyApiList, {
				data: {
					filters: {
						id: '10',
						myDateRange: { from: fakeDate }
					}
				}
			});

			await myApiList.validate();

			await myApiList.process();

			assertGet({
				filters: {
					id: '10',
					myDateRangeStartFrom: fakeDate
				}
			});
		});

		describe('formatSortables', () => {

			beforeEach(() => {
				sinon.stub(MyModel.prototype, 'get')
					.resolves([]);
			});

			it('Should use formatSortables method and don\'t modify the sortables', async () => {

				class MyApiList extends ApiListData {

					get sortableFields() {
						return ['foo', 'bar', 'test'];
					}

					formatSortables(sorts) {

						const currentSorts = Object.keys(sorts).reduce((accum, key, idx, array) => {
							if(key === 'test' && !array.includes('foo'))
								return { ...accum, someField: 'asc' };

							return { ...accum, [key]: sorts[key] };
						}, {});

						return currentSorts;
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					data: { sortBy: ['foo', 'bar', 'test'] }
				});

				await myApiList.validate();

				await myApiList.process();

				assertGet({
					order: {
						foo: 'asc',
						bar: 'asc',
						test: 'asc'
					}
				});
			});

			it('Should use formatSortables method and change the sortables', async () => {

				class MyApiList extends ApiListData {

					get sortableFields() {
						return ['foo', 'bar', 'test'];
					}

					formatSortables(sorts) {

						const currentSorts = Object.keys(sorts).reduce((accum, key) => {
							if(key === 'test') {
								const customSorts = { someField: 'asc' };

								return { ...accum, ...customSorts };
							}

							return { ...accum, [key]: sorts[key] };
						}, {});

						return currentSorts;
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					data: { sortBy: ['foo', 'bar', 'test'] }
				});

				await myApiList.validate();

				await myApiList.process();

				assertGet({
					order: {
						foo: 'asc',
						bar: 'asc',
						someField: 'asc'
					}
				});
			});
		});

		describe('maxPageSize getter', () => {

			beforeEach(() => {
				sinon.stub(MyModel.prototype, 'get')
					.resolves([]);
			});

			it('Should use a big page-size when Api allows it', async () => {

				class MyApiList extends ApiListData {

					get maxPageSize() {
						return 1500;
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					headers: {
						'x-janis-page': 1,
						'x-janis-page-size': 1200
					}
				});

				await myApiList.validate();

				await myApiList.process();

				assertGet({ limit: 1200 });
			});

			it('Should reject validation when the page-size configured is overcome', async () => {

				class MyApiList extends ApiListData {

					get maxPageSize() {
						return 1500;
					}
				}

				const myApiList = getApiInstance(MyApiList, {
					headers: {
						'x-janis-page': 2,
						'x-janis-page-size': 5000
					}
				});

				await assert.rejects(() => myApiList.validate(), ApiListError);

				sinon.assert.notCalled(MyModel.prototype.get);
			});
		});

		describe('Calculate totals', () => {

			const row = { foo: 'bar' };
			const results = new Array(60).fill(row);

			beforeEach(() => {
				sinon.stub(MyModel.prototype, 'get')
					.resolves(results);

				sinon.stub(MyModel.prototype, 'getTotals')
					.resolves({ total: 1 });
			});

			afterEach(() => {
				assertGet();
			});

			it('Should not calculate totals when no header received (default behavior)', async () => {

				const myApiList = getApiInstance(ApiListData);

				await myApiList.validate();

				await myApiList.process();

				sinon.assert.notCalled(MyModel.prototype.getTotals);
			});

			it('Should not calculate totals if no data is found', async () => {

				MyModel.prototype.get.resolves([]);
				MyModel.prototype.getTotals.resolves({ total: 0 });

				const myApiList = getApiInstance(ApiListData, {
					headers: { 'x-janis-totals': true }
				});

				await myApiList.validate();

				await myApiList.process();

				sinon.assert.notCalled(MyModel.prototype.getTotals);

				assert.deepStrictEqual(myApiList.response.headers, { 'x-janis-total': 0 });
			});

			[true, 'true', '1', 'max=0'].forEach(value => {
				it(`Should calculate totals when x-janis-totals header received as ${value} ${typeof value}`, async () => {

					const myApiList = getApiInstance(ApiListData, {
						headers: { 'x-janis-totals': value }
					});

					await myApiList.validate();

					await myApiList.process();

					sinon.assert.calledOnceWithExactly(MyModel.prototype.getTotals,
						{}, // filters
						undefined // no options for backward compatibility
					);

					assert.deepStrictEqual(myApiList.response.headers, { 'x-janis-total': 1 });
				});
			});

			[false, 'false', '0'].forEach(value => {
				it(`Should not calculate totals when x-janis-totals header received ${value} ${typeof value}`, async () => {

					const myApiList = getApiInstance(ApiListData, {
						headers: { 'x-janis-totals': value }
					});

					await myApiList.validate();

					await myApiList.process();

					sinon.assert.notCalled(MyModel.prototype.getTotals);

					assert.deepStrictEqual(myApiList.response.headers, {});

				});
			});

			it('Should calculate totals with limit when x-janis-totals header received as max=100', async () => {

				MyModel.prototype.get.resolves(results);

				MyModel.prototype.getTotals.resolves({ total: 100 });

				const myApiList = getApiInstance(ApiListData, {
					headers: { 'x-janis-totals': `max=${100}` }
				});

				await myApiList.validate();

				await myApiList.process();

				sinon.assert.calledOnceWithExactly(MyModel.prototype.getTotals,
					{}, // filters
					{ limit: 100 } // options with limit
				);

				assert.deepStrictEqual(myApiList.response.headers, { 'x-janis-total': 100 });
			});

			it('Should not calculate totals when the found results are less than the limit in the first page', async () => {

				MyModel.prototype.get.resolves([{ some: 'data' }]);

				MyModel.prototype.getTotals.resolves({ total: 10 });

				const myApiList = getApiInstance(ApiListData, {
					headers: { 'x-janis-totals': 'max=10' }
				});

				await myApiList.validate();

				await myApiList.process();

				sinon.assert.notCalled(MyModel.prototype.getTotals);

				assert.deepStrictEqual(myApiList.response.headers, { 'x-janis-total': 1 });
			});

		});

		describe('Calculate totals only', () => {

			beforeEach(() => {

				sinon.stub(MyModel.prototype, 'get')
					.resolves([{ some: 'data' }]);

				sinon.stub(MyModel.prototype, 'getTotals')
					.resolves({ total: 1 });
			});

			[true, 'true', '1'].forEach(value => {
				it(`Should calculate totals when x-janis-only-totals header received as ${value} ${typeof value}`, async () => {

					sinon.spy(ApiListData.prototype, 'formatRows');

					const myApiList = getApiInstance(ApiListData, {
						headers: { 'x-janis-only-totals': value }
					});

					await myApiList.validate();

					await myApiList.process();

					sinon.assert.calledOnceWithExactly(MyModel.prototype.getTotals,
						{}, // filters
						undefined // no options for backward compatibility
					);
					sinon.assert.notCalled(MyModel.prototype.get);
					sinon.assert.notCalled(ApiListData.prototype.formatRows);

					assert.deepStrictEqual(myApiList.response.headers, { 'x-janis-total': 1 });
					assert.deepStrictEqual(myApiList.response.body, undefined);
				});
			});

			[false, 'false', '0'].forEach(value => {
				it(`Should not calculate totals when x-janis-only-totals header received as ${value}(${typeof value})`, async () => {

					const myApiList = getApiInstance(ApiListData, {
						headers: { 'x-janis-only-totals': value }
					});

					await myApiList.validate();

					await myApiList.process();

					sinon.assert.notCalled(MyModel.prototype.getTotals);
					sinon.assert.calledOnce(MyModel.prototype.get);

					assert.deepStrictEqual(myApiList.response.headers, {});
				});
			});

			[100, 5000, 1].forEach(expectedLimit => {
				it(`Should calculate totals with limit when x-janis-only-totals header received as max=${expectedLimit}`, async () => {

					sinon.spy(ApiListData.prototype, 'formatRows');

					const myApiList = getApiInstance(ApiListData, {
						headers: { 'x-janis-only-totals': `max=${expectedLimit}` }
					});

					await myApiList.validate();

					await myApiList.process();

					sinon.assert.calledOnceWithExactly(MyModel.prototype.getTotals,
						{}, // filters
						{ limit: expectedLimit } // options with limit
					);
					sinon.assert.notCalled(MyModel.prototype.get);
					sinon.assert.notCalled(ApiListData.prototype.formatRows);

					assert.deepStrictEqual(myApiList.response.headers, { 'x-janis-total': 1 });
					assert.deepStrictEqual(myApiList.response.body, undefined);
				});
			});

		});

		describe('Return only params', () => {

			beforeEach(() => {

				sinon.spy(ApiListData.prototype, 'formatRows');

				sinon.stub(MyModel.prototype, 'get')
					.resolves([{ some: 'data' }]);

				sinon.stub(MyModel.prototype, 'getTotals')
					.resolves({ total: 1 });
			});

			const validSession = {
				getSessionInstance: Class => new Class(),
				isService: true
			};

			[true, 'true', '1'].forEach(value => {
				it(`Should return only params when is Service and x-janis-only-params header received as ${value} ${typeof value}`, async () => {

					const myApiList = getApiInstance(ApiListData, {
						session: validSession,
						headers: { 'x-janis-only-params': value }
					});

					await myApiList.validate();

					await myApiList.process();

					sinon.assert.notCalled(MyModel.prototype.getTotals);
					sinon.assert.notCalled(MyModel.prototype.get);
					sinon.assert.notCalled(ApiListData.prototype.formatRows);

					assert.deepStrictEqual(myApiList.response.headers, {});
					assert.deepStrictEqual(myApiList.response.body, {
						params: {
							page: 1,
							limit: 60
						},
						noResults: false
					});
				});

				it(`Should not return params when is not Service and x-janis-only-params header received as ${value} ${typeof value}`, async () => {

					const myApiList = getApiInstance(ApiListData, {
						session: { ...validSession, isService: false },
						headers: { 'x-janis-only-params': value }
					});

					await myApiList.validate();

					await myApiList.process();

					sinon.assert.notCalled(MyModel.prototype.getTotals);
					sinon.assert.calledOnce(MyModel.prototype.get);
					sinon.assert.calledOnce(ApiListData.prototype.formatRows);

					assert.deepStrictEqual(myApiList.response.headers, {});
					assert.deepStrictEqual(myApiList.response.body, [{ some: 'data' }]);
				});
			});

			[false, 'false', '0'].forEach(value => {
				it(`Should not return only params when is not Service and x-janis-only-params header received as ${value}(${typeof value})`, async () => {

					const myApiList = getApiInstance(ApiListData, {
						headers: { 'x-janis-only-params': value },
						session: validSession
					});

					await myApiList.validate();

					await myApiList.process();

					sinon.assert.notCalled(MyModel.prototype.getTotals);
					sinon.assert.calledOnce(MyModel.prototype.get);

					assert.deepStrictEqual(myApiList.response.headers, {});
				});
			});
		});

		describe('Reducing response with fields and excludeFields', () => {

			beforeEach(() => {
				sinon.stub(MyModel.prototype, 'get')
					.resolves([]);
			});

			context('When invalid parameters received', () => {

				it('Should reject if fields param is received as string', async () => {

					const myApiList = getApiInstance(ApiListData, {
						data: { fields: 'foo' }
					});

					await assert.rejects(myApiList.validate(), ApiListError);
				});

				it('Should reject if fields param is received as number', async () => {

					const myApiList = getApiInstance(ApiListData, {
						data: { fields: 8 }
					});

					await assert.rejects(myApiList.validate(), ApiListError);
				});

				it('Should reject if excludeFields param is received as string', async () => {

					const myApiList = getApiInstance(ApiListData, {
						data: { excludeFields: 'bar' }
					});

					await assert.rejects(myApiList.validate(), ApiListError);
				});

				it('Should reject if excludeFields param is received as number', async () => {

					const myApiList = getApiInstance(ApiListData, {
						data: { excludeFields: 10 }
					});

					await assert.rejects(myApiList.validate(), ApiListError);
				});
			});

			context('When received valid fields', () => {

				it('Should select the fields', async () => {

					const myApiList = getApiInstance(ApiListData, {
						data: { fields: ['foo'] }
					});

					await myApiList.validate();

					await myApiList.process();

					assertGet({ fields: ['foo'] });
				});

				it('Should select the fields and ignore received excludeFields', async () => {

					const myApiList = getApiInstance(ApiListData, {
						data: {
							fields: ['foo'],
							excludeFields: ['bar']
						}
					});

					await myApiList.validate();

					await myApiList.process();

					assertGet({ fields: ['foo'] });
				});

				it('Should ignore fields when Api denied select fields', async () => {

					class MyApiList extends ApiListData {
						get fieldsToSelect() {
							return false;
						}
					}

					const myApiList = getApiInstance(MyApiList, {
						data: { fields: ['foo'] }
					});

					await myApiList.validate();

					await myApiList.process();

					assertGet();
				});

				it('Should select the fields respecting Api fields to select definition', async () => {

					class MyApiList extends ApiListData {
						get fieldsToSelect() {
							return ['foo', 'bar'];
						}
					}

					const myApiList = getApiInstance(MyApiList, {
						data: { fields: ['foo', 'not-allowed-field'] }
					});

					await myApiList.validate();

					await myApiList.process();

					assertGet({ fields: ['foo'] });
				});

				it('Should select the fields and add fixed fields defined by the Api', async () => {

					class MyApiList extends ApiListData {
						get fixedFields() {
							return ['bar'];
						}
					}

					const myApiList = getApiInstance(MyApiList, {
						data: { fields: ['foo'] }
					});

					await myApiList.validate();

					await myApiList.process();

					assertGet({ fields: ['foo', 'bar'] });
				});

				it('Should select the fields and exclude fields defined by the Api', async () => {

					class MyApiList extends ApiListData {
						get fieldsToExclude() {
							return ['bar'];
						}
					}

					const myApiList = getApiInstance(MyApiList, {
						data: { fields: ['foo', 'bar'] }
					});

					await myApiList.validate();

					await myApiList.process();

					assertGet({ fields: ['foo'] });
				});

				it('Should not format the rows when fields are received', async () => {

					MyModel.prototype.get.resolves([{
						foo: 'bar'
					}]);

					class MyApiList extends ApiListData {
						formatRows(rows) {
							return rows.map(row => ({
								...row,
								newField: true
							}));
						}
					}

					const myApiList = getApiInstance(MyApiList, {
						data: { fields: ['foo'] }
					});

					await myApiList.validate();

					await myApiList.process();

					assert.deepStrictEqual(myApiList.response.body, [{
						foo: 'bar'
					}]);

					assertGet({ fields: ['foo'] });
				});

				it('Should format the rows when alwaysCallFormatter is true, even if fields are received', async () => {

					MyModel.prototype.get.resolves([{
						foo: 'bar'
					}]);

					class MyApiList extends ApiListData {

						get alwaysCallFormatter() {
							return true;
						}

						formatRows(rows) {
							return rows.map(row => ({
								...row,
								newField: true
							}));
						}
					}

					const myApiList = getApiInstance(MyApiList, {
						data: { fields: ['foo'] }
					});

					await myApiList.validate();

					await myApiList.process();

					assert.deepStrictEqual(myApiList.response.body, [{
						foo: 'bar',
						newField: true
					}]);

					assertGet({ fields: ['foo'] });
				});

				it('Should not format the rows when excludeFields are received', async () => {

					MyModel.prototype.get.resolves([{
						foo: 'bar'
					}]);

					class MyApiList extends ApiListData {
						formatRows(rows) {
							return rows.map(row => ({
								...row,
								newField: true
							}));
						}
					}

					const myApiList = getApiInstance(MyApiList, {
						data: { excludeFields: ['baz'] }
					});

					await myApiList.validate();

					await myApiList.process();

					assert.deepStrictEqual(myApiList.response.body, [{
						foo: 'bar'
					}]);

					assertGet({ excludeFields: ['baz'] });
				});

				it('Should format the rows when alwaysCallFormatter is true, even if excludeFields are received', async () => {

					MyModel.prototype.get.resolves([{
						foo: 'bar'
					}]);

					class MyApiList extends ApiListData {

						get alwaysCallFormatter() {
							return true;
						}

						formatRows(rows) {
							return rows.map(row => ({
								...row,
								newField: true
							}));
						}
					}

					const myApiList = getApiInstance(MyApiList, {
						data: { excludeFields: ['baz'] }
					});

					await myApiList.validate();

					await myApiList.process();

					assert.deepStrictEqual(myApiList.response.body, [{
						foo: 'bar',
						newField: true
					}]);

					assertGet({ excludeFields: ['baz'] });
				});
			});

			context('When Api has fieldsToSelect defined', () => {

				it('Should select the fields', async () => {

					class MyApiList extends ApiListData {
						get fieldsToSelect() {
							return ['foo', 'bar'];
						}
					}

					const myApiList = getApiInstance(MyApiList);

					await myApiList.validate();

					await myApiList.process();

					assertGet({ fields: ['foo', 'bar'] });
				});

				it('Should select the fields and add the fixedFields defined by the Api', async () => {

					class MyApiList extends ApiListData {
						get fieldsToSelect() {
							return ['foo'];
						}

						get fixedFields() {
							return ['bar'];
						}
					}

					const myApiList = getApiInstance(MyApiList);

					await myApiList.validate();

					await myApiList.process();

					assertGet({ fields: ['foo', 'bar'] });
				});

				it('Should select the fields but exclude the excludeFields when received by param', async () => {

					class MyApiList extends ApiListData {
						get fieldsToSelect() {
							return ['foo', 'bar'];
						}
					}

					const myApiList = getApiInstance(MyApiList, {
						data: { excludeFields: ['foo'] }
					});

					await myApiList.validate();

					await myApiList.process();

					assertGet({ fields: ['bar'] });
				});

				it('Should format the rows when no fields or excludeFields are received as params', async () => {

					MyModel.prototype.get.resolves([{
						foo: 'bar'
					}]);

					class MyApiList extends ApiListData {

						get fieldsToSelect() {
							return ['foo'];
						}

						formatRows(rows) {
							return rows.map(row => ({
								...row,
								newField: true
							}));
						}
					}

					const myApiList = getApiInstance(MyApiList, {
						data: {}
					});

					await myApiList.validate();

					await myApiList.process();

					assert.deepStrictEqual(myApiList.response.body, [{
						foo: 'bar',
						newField: true
					}]);

					assertGet({ fields: ['foo'] });
				});
			});

			context('When received valid excludeFields', () => {

				it('Should exclude the fields', async () => {

					const myApiList = getApiInstance(ApiListData, {
						data: { excludeFields: ['foo'] }
					});

					await myApiList.validate();

					await myApiList.process();

					assertGet({ excludeFields: ['foo'] });
				});

				it('Should not to exclude fields when Api now allows it', async () => {

					class MyApiList extends ApiListData {
						get fieldsToExclude() {
							return false;
						}
					}

					const myApiList = getApiInstance(MyApiList, {
						data: { excludeFields: ['foo'] }
					});

					await myApiList.validate();

					await myApiList.process();

					assertGet();
				});

				it('Should exclude the fields and also those fields defined by the Api', async () => {

					class MyApiList extends ApiListData {
						get fieldsToExclude() {
							return ['bar'];
						}
					}

					const myApiList = getApiInstance(MyApiList, {
						data: { excludeFields: ['foo'] }
					});

					await myApiList.validate();

					await myApiList.process();

					assertGet({ excludeFields: ['foo', 'bar'] });
				});

				it('Should exclude the fields respecting fixed fields defined by the Api', async () => {

					class MyApiList extends ApiListData {
						get fixedFields() {
							return ['bar'];
						}
					}

					const myApiList = getApiInstance(MyApiList, {
						data: { excludeFields: ['foo', 'bar'] }
					});

					await myApiList.validate();

					await myApiList.process();

					assertGet({ excludeFields: ['foo'] });
				});
			});

			context('When Api defines fieldsToExclude', () => {
				it('Should exclude the fields', async () => {

					class MyApiList extends ApiListData {
						get fieldsToExclude() {
							return ['bar'];
						}
					}

					const myApiList = getApiInstance(MyApiList);

					await myApiList.validate();

					await myApiList.process();

					assertGet({ excludeFields: ['bar'] });
				});

				it('Should exclude the fields respecting fixed fields defined by the Api', async () => {

					class MyApiList extends ApiListData {
						get fieldsToExclude() {
							return ['foo', 'bar'];
						}

						get fixedFields() {
							return ['bar'];
						}
					}

					const myApiList = getApiInstance(MyApiList);

					await myApiList.validate();

					await myApiList.process();

					assertGet({ excludeFields: ['foo'] });
				});

				it('Should format the rows when no fields or excludeFields are received as params', async () => {

					MyModel.prototype.get.resolves([{
						foo: 'bar'
					}]);

					class MyApiList extends ApiListData {

						get fieldsToExclude() {
							return ['baz'];
						}

						formatRows(rows) {
							return rows.map(row => ({
								...row,
								newField: true
							}));
						}
					}

					const myApiList = getApiInstance(MyApiList, {
						data: {}
					});

					await myApiList.validate();

					await myApiList.process();

					assert.deepStrictEqual(myApiList.response.body, [{
						foo: 'bar',
						newField: true
					}]);

					assertGet({ excludeFields: ['baz'] });
				});
			});
		});
	});
});
