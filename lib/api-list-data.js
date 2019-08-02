'use strict';

const { API } = require('@janiscommerce/api');
const { struct } = require('superstruct');
const path = require('path');

const EndpointParser = require('./helpers/endpoint-parser');

const ApiListError = require('./api-list-error');
const { Filter, Paging, Sort } = require('./data-helpers');

class ApiListData extends API {

	get fieldsToSelect() {
		return undefined;
	}

	get sortableFields() {
		return [];
	}

	get availableFilters() {
		return [];
	}

	async validate() {

		this._parseEndpoint();

		const requestFilters = {
			...this.data.filters || {},
			...this.parents
		};

		this.filter = new Filter(requestFilters, this.availableFilters);
		this.paging = new Paging(this.headers);
		this.sort = new Sort(this.data, this.sortableFields);

		const listDataStruct = struct({
			...this.filter.struct(),
			...this.sort.struct()
		}, {
			...this.filter.defaults(),
			...this.sort.defaults()
		});

		try {
			this.dataWithDefaults = listDataStruct({
				...this.data,
				...(Object.keys(requestFilters).length ? { filters: requestFilters } : {})
			});
		} catch(e) {
			throw new ApiListError(e.message, ApiListError.codes.INVALID_REQUEST_DATA);
		}

		const listHeadersStruct = struct.interface({
			...this.paging.struct()
		}, {
			...this.paging.defaults()
		});

		try {
			this.headersWithDefaults = listHeadersStruct(this.headers);
		} catch(e) {
			throw new ApiListError(e.message, ApiListError.codes.INVALID_REQUEST_DATA);
		}

		this._validateModel();
	}

	async process() {

		try {

			const getParams = {
				...this.filter.getParams(this.dataWithDefaults),
				...this.sort.getParams(this.dataWithDefaults),
				...this.paging.getParams(this.headersWithDefaults)
			};

			if(this.fieldsToSelect)
				getParams.fields = this.fieldsToSelect;

			const result = await this.model.get(getParams);
			const totals = result.length ? await this.model.getTotals() : { total: 0 };

			const { total } = totals;

			const rows = this.formatRows ? await this.formatRows(result) : result;

			this.setBody({
				rows,
				total
			});

		} catch(e) {
			throw new ApiListError(e.message, ApiListError.codes.INTERNAL_ERROR);
		}
	}

	_parseEndpoint() {

		const { modelName, parents } = EndpointParser.parse(this.endpoint);

		this.modelName = modelName;
		this.parents = parents;
	}

	_validateModel() {
		try {
			this.model = this._getModelInstance(path.join(process.cwd(), process.env.MS_PATH || '', 'models', this.modelName));
		} catch(e) {
			throw new ApiListError(e.message, ApiListError.codes.INVALID_ENTITY);
		}
	}

	/* istanbul ignore next */
	_getModelInstance(modelPath) {
		// eslint-disable-next-line global-require, import/no-dynamic-require
		const Model = require(modelPath);
		return this.client ? this.client.getInstance(Model) : new Model();
	}

}

module.exports = ApiListData;
