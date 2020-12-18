'use strict';

const assert = require('assert');
const path = require('path');

const sinon = require('sinon');
const mockRequire = require('mock-require');

const { ApiListData } = require('..');
const { ApiListError } = require('../lib');

describe('Api List Data', () => {

	afterEach(() => {
		sinon.restore();
	});

	class Model {
	}

	const modelPath = path.join(process.cwd(), '', 'models', 'some-entity');
	const modelPathWithMsPath = path.join(process.cwd(), 'src', 'models', 'some-entity');

	describe('Validation', () => {

		let env;

		before(() => {
			env = { ...process.env };
			process.env.MS_PATH = '';
			mockRequire(modelPath, Model);
		});

		after(() => {
			process.env = env;
			mockRequire.stop(modelPath);
		});

		it('Should throw if endpoint is not a valid rest endpoint', async () => {

			const apiListData = new ApiListData();
			apiListData.endpoint = '/';
			apiListData.data = {};
			apiListData.headers = {};

			await assert.rejects(() => apiListData.validate(), ApiListError);
		});

		it('Should throw if model is not found', async () => {

			const apiListData = new ApiListData();
			apiListData.endpoint = '/some-other-entity';
			apiListData.data = {};
			apiListData.headers = {};

			await assert.rejects(() => apiListData.validate(), ApiListError);
		});

		it('Should validate if no data is passed', async () => {

			const apiListData = new ApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {};
			apiListData.headers = {};

			const validation = await apiListData.validate();

			assert.strictEqual(validation, undefined);
		});

		it('Shouldn\'t throw because of unknown headers', async () => {

			const apiListData = new ApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {};
			apiListData.headers = {
				'x-foo': 'bar'
			};

			const validation = await apiListData.validate();

			assert.strictEqual(validation, undefined);
		});

		it('Should set default values if no data is passed', async () => {

			const apiListData = new ApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {};
			apiListData.headers = {};

			const validation = await apiListData.validate();

			assert.strictEqual(validation, undefined);

			assert.deepStrictEqual(apiListData.dataWithDefaults, {});
			assert.deepStrictEqual(apiListData.headersWithDefaults, {
				'x-janis-page': 1,
				'x-janis-page-size': 60
			});
		});

		it('Should set default sort direction if only sort field is passed', async () => {

			class MyApiListData extends ApiListData {
				get sortableFields() {
					return ['id'];
				}
			}

			const apiListData = new MyApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {};
			apiListData.headers = {};

			const validation = await apiListData.validate();

			assert.strictEqual(validation, undefined);

			assert.deepStrictEqual(apiListData.dataWithDefaults, {});
			assert.deepStrictEqual(apiListData.headersWithDefaults, {
				'x-janis-page': 1,
				'x-janis-page-size': 60
			});
		});

		it('Should return the limit and page as integers when headers are integers', async () => {

			const apiListData = new ApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {};
			apiListData.headers = {
				'x-janis-page': 1,
				'x-janis-page-size': 60
			};

			const validation = await apiListData.validate();

			assert.strictEqual(validation, undefined);

			assert.deepStrictEqual(apiListData.dataWithDefaults, {});
			assert.deepStrictEqual(apiListData.paging.getParams(apiListData.headersWithDefaults), {
				limit: 60,
				page: 1
			});
		});

		it('Should return the limit and page as integers when headers are strings', async () => {

			const apiListData = new ApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {};
			apiListData.headers = {
				'x-janis-page': '1',
				'x-janis-page-size': '60'
			};

			const validation = await apiListData.validate();

			assert.strictEqual(validation, undefined);

			assert.deepStrictEqual(apiListData.dataWithDefaults, {});
			assert.deepStrictEqual(apiListData.paging.getParams(apiListData.headersWithDefaults), {
				limit: 60,
				page: 1
			});
		});

		it('Should throw if page header is invalid strings', async () => {

			const apiListData = new ApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {};
			apiListData.headers = {
				'x-janis-page': '1page'
			};

			await assert.rejects(() => apiListData.validate(), err => {
				return err instanceof ApiListError
					&& !!err.message.includes('x-janis-page')
					&& !!err.message.includes('1page');
			});
		});

		it('Should throw if page size header is invalid strings', async () => {

			const apiListData = new ApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {};
			apiListData.headers = {
				'x-janis-page-size': '60pages'
			};

			await assert.rejects(() => apiListData.validate(), err => {
				return err instanceof ApiListError
					&& !!err.message.includes('x-janis-page-size')
					&& !!err.message.includes('60pages');
			});
		});

		it('Should throw if sort field is passed and there are no sortable fields', async () => {

			const apiListData = new ApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {
				sortBy: 'id'
			};
			apiListData.headers = {};

			await assert.rejects(() => apiListData.validate(), err => {
				return err instanceof ApiListError
					&& !!err.message.includes('sortBy')
					&& !!err.message.includes('id')
					&& !!err.message.includes('undefined');
			});
		});

		it('Should throw if invalid sort field is passed', async () => {

			class MyApiListData extends ApiListData {
				get sortableFields() {
					return ['id'];
				}
			}

			const apiListData = new MyApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {
				sortBy: 'invalidField'
			};
			apiListData.headers = {};

			await assert.rejects(() => apiListData.validate(), err => {
				return err instanceof ApiListError
					&& !!err.message.includes('sortBy')
					&& !!err.message.includes('invalidField');
			});
		});

		it('Should throw if invalid sort direction is passed', async () => {

			class MyApiListData extends ApiListData {
				get sortableFields() {
					return ['id'];
				}
			}

			const apiListData = new MyApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {
				sortBy: 'id',
				sortDirection: 'unknownValue'
			};
			apiListData.headers = {};

			await assert.rejects(() => apiListData.validate(), err => {
				return err instanceof ApiListError
					&& !!err.message.includes('sortDirection')
					&& !!err.message.includes('unknownValue');
			});
		});

		it('Should throw if invalid page is passed', async () => {

			const apiListData = new ApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {};
			apiListData.headers = {
				'x-janis-page': -10
			};

			await assert.rejects(() => apiListData.validate(), err => {
				return err instanceof ApiListError
					&& !!err.message.includes('x-janis-page')
					&& !!err.message.includes('-10');
			});
		});

		it('Should throw if invalid page size is passed', async () => {

			const apiListData = new ApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {};
			apiListData.headers = {
				'x-janis-page-size': -10
			};

			await assert.rejects(() => apiListData.validate(), err => {
				return err instanceof ApiListError
					&& !!err.message.includes('x-janis-page-size')
					&& !!err.message.includes('-10');
			});
		});

		it('Should throw if a page size grater than the max size is passed', async () => {

			const apiListData = new ApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {};
			apiListData.headers = {
				'x-janis-page-size': 500
			};

			await assert.rejects(() => apiListData.validate(), err => {
				return err instanceof ApiListError
					&& !!err.message.includes('x-janis-page-size')
					&& !!err.message.includes('500');
			});
		});

		it('Should throw if available-filter is invalid', async () => {

			class InvalidListApi extends ApiListData {

				get availableFilters() {
					return 'invalid';
				}
			}

			const apiListData = new InvalidListApi();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {
				filters: {
					invalid: 'bar'
				}
			};
			apiListData.headers = {};

			await assert.rejects(() => apiListData.validate(), { name: ApiListError.name, code: ApiListError.codes.INVALID_FILTERS });
		});

		it('Should throw if search-filter is invalid', async () => {

			class InvalidListApi extends ApiListData {

				get searchFilters() {
					return 'invalid';
				}
			}

			const apiListData = new InvalidListApi();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {
				filters: {
					invalid: 'bar'
				}
			};
			apiListData.headers = {};

			await assert.rejects(() => apiListData.validate(), { name: ApiListError.name, code: ApiListError.codes.INVALID_FILTERS });
		});

		it('Should throw if static-filter is invalid', async () => {

			class InvalidListApi extends ApiListData {

				get staticFilters() {
					return 'invalid';
				}
			}

			const apiListData = new InvalidListApi();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {
				filters: {
					invalid: 'bar'
				}
			};
			apiListData.headers = {};

			await assert.rejects(() => apiListData.validate(), { name: ApiListError.name, code: ApiListError.codes.INVALID_FILTERS });
		});

		it('Should throw if filter is passed and there are no available filters', async () => {

			const apiListData = new ApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {
				filters: {
					foo: 'bar'
				}
			};
			apiListData.headers = {};

			await assert.rejects(() => apiListData.validate(), err => {
				return err instanceof ApiListError
					&& !!err.message.includes('filters')
					&& !!err.message.includes('undefined');
			});
		});

		it('Should throw if search filter is passed and there are no search filters', async () => {

			const apiListData = new ApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {
				filters: {
					search: 'bar'
				}
			};
			apiListData.headers = {};

			await assert.rejects(() => apiListData.validate(), err => {
				return err instanceof ApiListError
					&& !!err.message.includes('filters')
					&& !!err.message.includes('undefined');
			});
		});

		it('Should throw if invalid filter is passed', async () => {

			class MyApiListData extends ApiListData {
				get availableFilters() {
					return ['id'];
				}
			}

			const apiListData = new MyApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {
				filters: {
					foo: 'bar'
				}
			};
			apiListData.headers = {};

			await assert.rejects(() => apiListData.validate(), err => {
				return err instanceof ApiListError
					&& !!err.message.includes('filters')
					&& !!err.message.includes('filters.foo');
			});
		});

		it('Should validate if valid data is passed', async () => {

			class MyApiListData extends ApiListData {

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
			}

			const apiListData = new MyApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {
				filters: {
					id: '10',
					id2: '100',
					search: '1000'
				},
				sortBy: 'foo',
				sortDirection: 'asc'
			};
			apiListData.headers = {
				'x-janis-page': '3',
				'x-janis-page-size': '20'
			};

			const validation = await apiListData.validate();

			assert.strictEqual(validation, undefined);
		});
	});

	describe('Validation with MS_PATH', () => {

		let env;

		before(() => {
			env = { ...process.env };
			process.env.MS_PATH = 'src';
			mockRequire(modelPathWithMsPath, Model);
		});

		after(() => {
			process.env = env;
			mockRequire.stop(modelPathWithMsPath);
		});

		it('Should validate if valid data is passed', async () => {

			class MyApiListData extends ApiListData {

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

			const apiListData = new MyApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {
				filters: {
					id: '10',
					id2: '100'
				},
				sortBy: 'foo',
				sortDirection: 'asc'
			};
			apiListData.headers = {
				'x-janis-page': '3',
				'x-janis-page-size': '20'
			};

			const validation = await apiListData.validate();

			assert.strictEqual(validation, undefined);
		});
	});

	describe('Process', () => {

		let env;

		before(() => {
			env = { ...process.env };
			process.env.MS_PATH = '';
		});

		after(() => {
			process.env = env;
		});

		it('Should throw an internal error if get fails', async () => {

			mockRequire(modelPath, class MyModel {
				async get() {
					throw new Error('Some internal error');
				}
			});

			const apiListData = new ApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {};
			apiListData.headers = {};

			await apiListData.validate();

			await assert.rejects(() => apiListData.process());

			mockRequire.stop(modelPath);
		});

		it('Should pass the default parameters to the model get', async () => {

			class MyModel {
				async get() {
					return [];
				}
			}

			mockRequire(modelPath, MyModel);

			sinon.spy(MyModel.prototype, 'get');

			const apiListData = new ApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {};
			apiListData.headers = {};

			await apiListData.validate();

			await apiListData.process();

			sinon.assert.calledOnce(MyModel.prototype.get);
			sinon.assert.calledWithExactly(MyModel.prototype.get, {
				page: 1,
				limit: 60
			});

			mockRequire.stop(modelPath);
		});

		it('Should pass client defined parameters to the model get', async () => {

			class MyModel {
				async get() {
					return [];
				}
			}

			mockRequire(modelPath, MyModel);

			sinon.spy(MyModel.prototype, 'get');

			class MyApiListData extends ApiListData {

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

			const apiListData = new MyApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {
				sortBy: 'foo',
				sortDirection: 'DESC',
				filters: {
					id: '10',
					id2: '100'
				}
			};
			apiListData.headers = {
				'x-janis-page': 2,
				'x-janis-page-size': 20
			};

			await apiListData.validate();

			await apiListData.process();

			sinon.assert.calledOnce(MyModel.prototype.get);
			sinon.assert.calledWithExactly(MyModel.prototype.get, {
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

			mockRequire.stop(modelPath);
		});

		it('Should pass client defined parameters when it recieves an array of filters to the model get', async () => {

			class MyModel {
				async get() {
					return [];
				}
			}

			mockRequire(modelPath, MyModel);

			sinon.spy(MyModel.prototype, 'get');

			class MyApiListData extends ApiListData {

				get availableFilters() {
					return [
						'id',
						{
							name: 'name',
							valueMapper: value => value.toUpperCase()
						}
					];
				}
			}

			const apiListData = new MyApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {
				filters: {
					id: '10',
					name: ['foo', 'bar']
				}
			};
			apiListData.headers = {
				'x-janis-page': 2,
				'x-janis-page-size': 20
			};

			await apiListData.validate();

			await apiListData.process();

			sinon.assert.calledOnce(MyModel.prototype.get);
			sinon.assert.calledWithExactly(MyModel.prototype.get, {
				page: 2,
				limit: 20,
				filters: {
					id: '10',
					name: ['FOO', 'BAR']
				}
			});

			mockRequire.stop(modelPath);
		});

		it('Should pass endpoint parents to the model get as filters', async () => {

			class MyModel {
				async get() {
					return [];
				}
			}

			mockRequire(modelPath, MyModel);

			sinon.spy(MyModel.prototype, 'get');

			class MyApiListData extends ApiListData {

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

			const apiListData = new MyApiListData();
			apiListData.endpoint = '/some-parent/1/some-entity';
			apiListData.data = {
				sortBy: 'foo',
				sortDirection: 'DESC',
				filters: {
					id: '10',
					id2: '100',
					hasSubProperty: 'myProp'
				}
			};
			apiListData.headers = {
				'x-janis-page': 2,
				'x-janis-page-size': 20
			};

			await apiListData.validate();

			await apiListData.process();

			sinon.assert.calledOnce(MyModel.prototype.get);
			sinon.assert.calledWithExactly(MyModel.prototype.get, {
				page: 2,
				limit: 20,
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

			mockRequire.stop(modelPath);
		});

		it('Should pass fields to select if the getter is defined', async () => {

			class MyModel {
				async get() {
					return [];
				}
			}

			mockRequire(modelPath, MyModel);

			sinon.spy(MyModel.prototype, 'get');

			class MyApiListData extends ApiListData {
				get fieldsToSelect() {
					return ['id', 'name', 'status'];
				}
			}

			const apiListData = new MyApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {};
			apiListData.headers = {};

			await apiListData.validate();

			await apiListData.process();

			sinon.assert.calledOnce(MyModel.prototype.get);
			sinon.assert.calledWithExactly(MyModel.prototype.get, {
				page: 1,
				limit: 60,
				fields: ['id', 'name', 'status']
			});

			mockRequire.stop(modelPath);
		});

		it('Should use regular model when there is no session in API', async () => {

			class MyModel {
				async get() {
					return [];
				}
			}

			mockRequire(modelPath, MyModel);

			sinon.spy(MyModel.prototype, 'get');

			class MyApiListData extends ApiListData {
				get fieldsToSelect() {
					return ['id', 'name', 'status'];
				}
			}

			const apiListData = new MyApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {};
			apiListData.headers = {};

			await apiListData.validate();

			await apiListData.process();

			sinon.assert.calledOnce(MyModel.prototype.get);
			sinon.assert.calledWithExactly(MyModel.prototype.get, {
				page: 1,
				limit: 60,
				fields: ['id', 'name', 'status']
			});

			assert.deepStrictEqual(apiListData.model.session, undefined);

			mockRequire.stop(modelPath);
		});

		it('Should use injected model when API has a session', async () => {

			class MyModel {
				async get() {
					return [];
				}
			}

			mockRequire(modelPath, MyModel);

			sinon.spy(MyModel.prototype, 'get');

			class MyApiListData extends ApiListData {
				get fieldsToSelect() {
					return ['id', 'name', 'status'];
				}
			}

			const sessionMock = {
				getSessionInstance: sinon.fake(() => {
					const modelInstance = new MyModel();
					modelInstance.session = sessionMock;

					return modelInstance;
				})
			};

			const apiListData = new MyApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {};
			apiListData.headers = {};
			apiListData.session = sessionMock;

			await apiListData.validate();

			await apiListData.process();

			sinon.assert.calledOnce(MyModel.prototype.get);
			sinon.assert.calledWithExactly(MyModel.prototype.get, {
				page: 1,
				limit: 60,
				fields: ['id', 'name', 'status']
			});

			sinon.assert.calledOnce(sessionMock.getSessionInstance);
			sinon.assert.calledWithExactly(sessionMock.getSessionInstance, MyModel);

			mockRequire.stop(modelPath);
		});

		it('Should return an empty rows array and zero total rows if passed params do not find any result', async () => {

			class MyModel {
				async get() {
					return [];
				}
			}

			mockRequire(modelPath, MyModel);

			sinon.spy(MyModel.prototype, 'get');

			const apiListData = new ApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {};
			apiListData.headers = {};

			await apiListData.validate();

			await apiListData.process();

			assert.deepStrictEqual(apiListData.response.body, []);
			assert.deepStrictEqual(apiListData.response.headers, {
				'x-janis-total': 0
			});

			sinon.assert.calledOnce(MyModel.prototype.get);
			sinon.assert.calledWithExactly(MyModel.prototype.get, {
				page: 1,
				limit: 60
			});

			mockRequire.stop(modelPath);
		});

		it('Should return a rows array and total rows if passed params do find results', async () => {

			const row = {
				foo: 'bar'
			};

			class MyModel {
				async get() {
					return [row];
				}

				async getTotals() {
					return { total: 100 };
				}
			}

			mockRequire(modelPath, MyModel);

			sinon.spy(MyModel.prototype, 'get');
			sinon.spy(MyModel.prototype, 'getTotals');

			const apiListData = new ApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {};
			apiListData.headers = {};

			await apiListData.validate();

			await apiListData.process();

			assert.deepStrictEqual(apiListData.response.body, [row]);
			assert.deepStrictEqual(apiListData.response.headers, {
				'x-janis-total': 100
			});

			sinon.assert.calledOnce(MyModel.prototype.get);
			sinon.assert.calledWithExactly(MyModel.prototype.get, {
				page: 1,
				limit: 60
			});

			sinon.assert.calledOnce(MyModel.prototype.getTotals);

			mockRequire.stop(modelPath);
		});

		it('Should return a rows array (formatted) and total rows if passed params do find results', async () => {

			class MyApiListData extends ApiListData {

				formatRows(rows) {
					return rows.map(row => ({ ...row, moreFoo: true }));
				}

			}

			const row = {
				foo: 'bar'
			};

			class MyModel {
				async get() {
					return [row];
				}

				async getTotals() {
					return { total: 100 };
				}
			}

			mockRequire(modelPath, MyModel);

			sinon.spy(MyModel.prototype, 'get');
			sinon.spy(MyModel.prototype, 'getTotals');

			const apiListData = new MyApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {};
			apiListData.headers = {};

			await apiListData.validate();

			await apiListData.process();

			assert.deepStrictEqual(apiListData.response.body, [{
				foo: 'bar',
				moreFoo: true
			}]);
			assert.deepStrictEqual(apiListData.response.headers, {
				'x-janis-total': 100
			});

			sinon.assert.calledOnce(MyModel.prototype.get);
			sinon.assert.calledWithExactly(MyModel.prototype.get, {
				page: 1,
				limit: 60
			});

			sinon.assert.calledOnce(MyModel.prototype.getTotals);

			mockRequire.stop(modelPath);
		});

		it('Should format search filter with a single field', async () => {

			class MyModel {
				async get() {
					return [];
				}
			}

			mockRequire(modelPath, MyModel);

			sinon.spy(MyModel.prototype, 'get');

			class MyApiListData extends ApiListData {

				get searchFilters() {
					return ['id'];
				}
			}

			const apiListData = new MyApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {
				filters: {
					search: 'some-id'
				}
			};
			apiListData.headers = {
				'x-janis-page': 1,
				'x-janis-page-size': 20
			};

			await apiListData.validate();

			await apiListData.process();

			sinon.assert.calledOnce(MyModel.prototype.get);
			sinon.assert.calledWithExactly(MyModel.prototype.get, {
				filters: {
					id: { type: 'search', value: 'some-id' }
				},
				limit: 20,
				page: 1
			});

			mockRequire.stop(modelPath);
		});

		it('Should format search filter with multiple field with OR filters', async () => {

			class MyModel {
				async get() {
					return [];
				}
			}

			mockRequire(modelPath, MyModel);

			sinon.spy(MyModel.prototype, 'get');

			class MyApiListData extends ApiListData {

				get searchFilters() {
					return ['id', 'foo', 'bar'];
				}
			}

			const apiListData = new MyApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {
				filters: {
					search: 'some-id'
				}
			};
			apiListData.headers = {
				'x-janis-page': 1,
				'x-janis-page-size': 20
			};

			await apiListData.validate();

			await apiListData.process();

			sinon.assert.calledOnce(MyModel.prototype.get);
			sinon.assert.calledWithExactly(MyModel.prototype.get, {
				filters: [
					{ id: { type: 'search', value: 'some-id' } },
					{ foo: { type: 'search', value: 'some-id' } },
					{ bar: { type: 'search', value: 'some-id' } }
				],
				limit: 20,
				page: 1
			});

			mockRequire.stop(modelPath);
		});

		it('Should formatt search filter with multiple words in data request', async () => {

			class MyModel {
				async get() {
					return [];
				}
			}

			mockRequire(modelPath, MyModel);

			sinon.spy(MyModel.prototype, 'get');

			class MyApiListData extends ApiListData {

				get searchFilters() {
					return ['id', 'foo', 'bar'];
				}
			}

			const apiListData = new MyApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {
				filters: {
					search: 'some-id some-foo'
				}
			};
			apiListData.headers = {
				'x-janis-page': 1,
				'x-janis-page-size': 20
			};

			await apiListData.validate();

			await apiListData.process();

			sinon.assert.calledOnce(MyModel.prototype.get);
			sinon.assert.calledWithExactly(MyModel.prototype.get, {
				filters: [
					{ id: { type: 'search', value: 'some-id' } },
					{ id: { type: 'search', value: 'some-foo' } },
					{ foo: { type: 'search', value: 'some-id' } },
					{ foo: { type: 'search', value: 'some-foo' } },
					{ bar: { type: 'search', value: 'some-id' } },
					{ bar: { type: 'search', value: 'some-foo' } }
				],
				limit: 20,
				page: 1
			});

			mockRequire.stop(modelPath);
		});

		it('Should combine search filter with availableFilters', async () => {

			class MyModel {
				async get() {
					return [];
				}
			}

			mockRequire(modelPath, MyModel);

			sinon.spy(MyModel.prototype, 'get');

			class MyApiListData extends ApiListData {

				get availableFilters() {
					return [
						'other'
					];
				}

				get searchFilters() {
					return ['id', 'foo', 'bar'];
				}
			}

			const apiListData = new MyApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {
				filters: {
					search: 'some-id',
					other: 'something'
				}
			};
			apiListData.headers = {
				'x-janis-page': 1,
				'x-janis-page-size': 20
			};

			await apiListData.validate();

			await apiListData.process();

			sinon.assert.calledOnce(MyModel.prototype.get);
			sinon.assert.calledWithExactly(MyModel.prototype.get, {
				filters: [
					{ id: { type: 'search', value: 'some-id' }, other: 'something' },
					{ foo: { type: 'search', value: 'some-id' }, other: 'something' },
					{ bar: { type: 'search', value: 'some-id' }, other: 'something' }
				],
				limit: 20,
				page: 1
			});

			mockRequire.stop(modelPath);
		});

		it('Should use only static filter', async () => {

			class MyModel {
				async get() {
					return [];
				}
			}

			mockRequire(modelPath, MyModel);

			sinon.spy(MyModel.prototype, 'get');

			class MyApiListData extends ApiListData {

				get staticFilters() {
					return {
						foo: 1,
						bar: 2
					};
				}
			}

			const apiListData = new MyApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {};
			apiListData.headers = {
				'x-janis-page': 1,
				'x-janis-page-size': 20
			};

			await apiListData.validate();

			await apiListData.process();

			sinon.assert.calledOnce(MyModel.prototype.get);
			sinon.assert.calledWithExactly(MyModel.prototype.get, {
				filters: {
					foo: 1,
					bar: 2
				},
				limit: 20,
				page: 1
			});

			mockRequire.stop(modelPath);
		});

		it('Should combine static filter with availableFilters', async () => {

			class MyModel {
				async get() {
					return [];
				}
			}

			mockRequire(modelPath, MyModel);

			sinon.spy(MyModel.prototype, 'get');

			class MyApiListData extends ApiListData {

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

			const apiListData = new MyApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {
				filters: {
					other: 'something'
				}
			};
			apiListData.headers = {
				'x-janis-page': 1,
				'x-janis-page-size': 20
			};

			await apiListData.validate();

			await apiListData.process();

			sinon.assert.calledOnceWithExactly(MyModel.prototype.get, {
				filters: {
					foo: 1,
					bar: 2,
					other: 'something'
				},
				limit: 20,
				page: 1
			});

			mockRequire.stop(modelPath);
		});

		it('Should combine static, search filter with availableFilters', async () => {

			class MyModel {
				async get() {
					return [];
				}
			}

			mockRequire(modelPath, MyModel);

			sinon.spy(MyModel.prototype, 'get');

			class MyApiListData extends ApiListData {

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

			const apiListData = new MyApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {
				filters: {
					other: 'something',
					search: 'secret'
				}
			};
			apiListData.headers = {
				'x-janis-page': 1,
				'x-janis-page-size': 20
			};

			await apiListData.validate();

			await apiListData.process();

			sinon.assert.calledOnceWithExactly(MyModel.prototype.get, {
				filters: [
					{ some: { type: 'search', value: 'secret' }, foo: 1, bar: 2, other: 'something' },
					{ another: { type: 'search', value: 'secret' }, foo: 1, bar: 2, other: 'something' }
				],
				limit: 20,
				page: 1
			});

			mockRequire.stop(modelPath);
		});

		it('Should use custom model-name when it is setted', async () => {

			class CustomModel {
				async get() {
					return [];
				}
			}

			const customModelPath = path.join(process.cwd(), '', 'models', 'custom');

			mockRequire(customModelPath, CustomModel);

			sinon.spy(CustomModel.prototype, 'get');

			class MyApiListData extends ApiListData {

				get modelName() {
					return 'custom';
				}

				get fieldsToSelect() {
					return ['id', 'name', 'status'];
				}
			}

			const apiListData = new MyApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {};
			apiListData.headers = {};

			await apiListData.validate();

			await apiListData.process();

			sinon.assert.calledOnceWithExactly(CustomModel.prototype.get, {
				page: 1,
				limit: 60,
				fields: ['id', 'name', 'status']
			});

			assert.deepStrictEqual(apiListData.model.session, undefined);

			mockRequire.stop(modelPath);
		});

		it('Should use formatFilters method and modify a filter', async () => {

			class MyModel {
				async get() {
					return [];
				}
			}

			mockRequire(modelPath, MyModel);

			sinon.spy(MyModel.prototype, 'get');

			class MyApiListData extends ApiListData {

				get availableFilters() {
					return [
						'someQuanityFilter',
						'otherFilter'
					];
				}

				formatFilters(filters) {

					if(filters.someQuanityFilter && filters.someQuanityFilter > 100) {
						return {
							...filters,
							someQuanityFilter: 100
						};
					}

					return filters;
				}
			}

			const apiListData = new MyApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {
				filters: {
					someQuanityFilter: 150,
					otherFilter: 'something'
				}
			};
			apiListData.headers = {
				'x-janis-page': 1,
				'x-janis-page-size': 20
			};

			await apiListData.validate();

			await apiListData.process();

			sinon.assert.calledOnce(MyModel.prototype.get);
			sinon.assert.calledWithExactly(MyModel.prototype.get, {
				filters: {
					someQuanityFilter: 100,
					otherFilter: 'something'
				},
				limit: 20,
				page: 1
			});

			mockRequire.stop(modelPath);
		});

		it('Should use formatFilters method and override the filters', async () => {

			class MyModel {
				async get() {
					return [];
				}
			}

			mockRequire(modelPath, MyModel);

			sinon.spy(MyModel.prototype, 'get');

			class MyApiListData extends ApiListData {

				get availableFilters() {
					return [
						'someQuanityFilter',
						'otherFilter'
					];
				}

				formatFilters() {
					return { foo: 'bar' };
				}
			}

			const apiListData = new MyApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {
				filters: {
					someQuanityFilter: 150,
					otherFilter: 'something'
				}
			};
			apiListData.headers = {
				'x-janis-page': 1,
				'x-janis-page-size': 20
			};

			await apiListData.validate();

			await apiListData.process();

			sinon.assert.calledOnce(MyModel.prototype.get);
			sinon.assert.calledWithExactly(MyModel.prototype.get, {
				filters: {
					foo: 'bar'
				},
				limit: 20,
				page: 1
			});

			mockRequire.stop(modelPath);
		});

		it('Should use formatFilters method and don\'t modify the filters', async () => {

			class MyModel {
				async get() {
					return [];
				}
			}

			mockRequire(modelPath, MyModel);

			sinon.spy(MyModel.prototype, 'get');

			class MyApiListData extends ApiListData {

				get availableFilters() {
					return [
						'someQuanityFilter',
						'otherFilter'
					];
				}

				formatFilters(filters) {

					if(!filters)
						return filters;

					if(filters.someQuanityFilter && filters.someQuanityFilter > 100) {
						return {
							...filters,
							someQuanityFilter: 100
						};
					}

					return filters;
				}
			}

			const apiListData = new MyApiListData();
			apiListData.endpoint = '/some-entity';
			apiListData.data = {};
			apiListData.headers = {
				'x-janis-page': 1,
				'x-janis-page-size': 20
			};

			await apiListData.validate();

			await apiListData.process();

			sinon.assert.calledOnce(MyModel.prototype.get);
			sinon.assert.calledWithExactly(MyModel.prototype.get, {
				limit: 20,
				page: 1
			});

			mockRequire.stop(modelPath);
		});
	});
});
