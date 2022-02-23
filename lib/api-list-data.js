'use strict';

const { API } = require('@janiscommerce/api');
const { struct } = require('@janiscommerce/superstruct');
const path = require('path');

const EndpointParser = require('./helpers/endpoint-parser');

const ApiListError = require('./api-list-error');
const { Filter, Paging, Sort } = require('./data-helpers');

/**
 * @class ApiListData
 * @extends API
 * @classdesc Use this to list data.
 */
module.exports = class ApiListData extends API {

	/**
	 * Get the fields to select from the DB.
	 * This fields must be defined in the model.
	 *
	 * @returns {Array|undefined} - The fields to select
	 */
	get fieldsToSelect() {
		return undefined;
	}

	/**
	 * Get the fields to sort
	 *
	 * @returns {Array} - The fields to sort
	 */
	get sortableFields() {
		return [];
	}

	/**
	 * Get the available filters of the model
	 *
	 * @returns {Array} - The available filters
	 */
	get availableFilters() {
		return [];
	}

	/**
	 * Get the fields will be used to mapped multiple filters (OR Type) for the same value.
	 *
	 * @returns {Array} - The fields to search
	 */
	get searchFilters() {
		return [];
	}

	/**
	 * Get the filters with a fixed value for all requests.
	 *
	 * @returns {Object} - The static filters
	 */
	get staticFilters() {
		return {};
	}

	/**
	 * Validate the endpoint and structs of the request before process
	 *
	 * @async
	 * @throws {ApiListError} - If the request data is not valid
	 */
	async validate() {

		this._parseEndpoint();

		const requestFilters = {
			...this.data.filters || {},
			...this.parents
		};

		this.filter = new Filter(requestFilters, this.availableFilters, this.searchFilters, this.staticFilters);
		this.paging = new Paging(this.headers, (this.session && this.session.isService));
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
			throw new ApiListError(e, ApiListError.codes.INVALID_REQUEST_DATA);
		}

		const listHeadersStruct = struct.interface({
			...this.paging.struct()
		}, {
			...this.paging.defaults()
		});

		try {
			this.headersWithDefaults = listHeadersStruct(this.headers);
		} catch(e) {
			throw new ApiListError(e, ApiListError.codes.INVALID_REQUEST_DATA);
		}

		await this._validateModel();
	}

	/**
	 * It makes the query to the DB with the filters and params.
	 *
	 * @async
	 * @throws {ApiListError} - If the query fails
	 * @returns {void} - The query result
	 */
	async process() {

		try {

			const getParams = {
				...this.filter.getParams(this.dataWithDefaults),
				...this.sort.getParams(this.dataWithDefaults),
				...this.paging.getParams(this.headersWithDefaults)
			};

			if(this.fieldsToSelect)
				getParams.fields = this.fieldsToSelect;

			const formattedFilters = await this.formatFilters(getParams.filters);

			if(formattedFilters && typeof formattedFilters === 'object')
				getParams.filters = formattedFilters;

			const result = await this.model.get(getParams);
			const totals = result.length ? await this.model.getTotals() : { total: 0 };

			const { total } = totals;

			const rows = await this.formatRows(result);

			this.setBody(rows)
				.setHeader('x-janis-total', total);

		} catch(e) {
			throw new ApiListError(e, ApiListError.codes.INTERNAL_ERROR);
		}
	}

	/**
	 * Set the modelName and parents of API after parsing the endpoint
	 *
	 * @returns {void} - ModelName and parents
	 */
	_parseEndpoint() {

		const { modelName, parents } = EndpointParser.parse(this.endpoint);

		if(!this.modelName)
			this.modelName = modelName;
		this.parents = parents;
	}

	/**
	 * Set the model of the API getting the model instance from its name
	 *
	 * @async
	 * @throws {ApiListError} - if the model not exists
	 * @returns {void}
	 */
	async _validateModel() {
		try {
			this.model = await this._getModelInstance(path.join(process.cwd(), process.env.MS_PATH || '', 'models', this.modelName));
		} catch(e) {
			throw new ApiListError(e, ApiListError.codes.INVALID_ENTITY);
		}
	}

	/**
	 * Get the instance of the Model indicated by parameter
	 *
	 * @async
	 * @param {String} modelPath The model path
	 * @returns {Object} An instance injected with the session
	 */
	_getModelInstance(modelPath) {

		// eslint-disable-next-line global-require, import/no-dynamic-require
		const Model = require(modelPath);

		if(!this.session)
			return new Model();

		return this.session.getSessionInstance(Model);
	}

	/**
	 * Is used to programatically alter the filters. It will be executed after parsing static and dynamic filters.
	 * This method is used to format the filters before sending to the DB.
	 *
	 * @async
	 * @param {Object} filters - The filters to format
	 * @returns {Object} - The formatted filters
	 */
	formatFilters() {}

	/**
	 * Use this to format your records before they are returned.
	 * This method is called after the query to the DB.
	 *
	 * @async
	 * @param {Array} rows - The rows to format
	 * @returns {Array} - The formatted rows
	 */
	formatRows(rows) {
		return rows;
	}
};
