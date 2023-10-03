'use strict';

const path = require('path');
const { API } = require('@janiscommerce/api');
const { struct } = require('@janiscommerce/superstruct');

const EndpointParser = require('./helpers/endpoint-parser');

const ApiListError = require('./api-list-error');

const {
	Fields, Filter, Paging, Sort, CustomParameter
} = require('./data-helpers');

const { TOTAL_HEADER, CALCULATE_TOTALS_HEADER, CALCULATE_ONLY_TOTALS_HEADER } = require('./data-helpers/headers');

const { booleanMapper } = require('./filter-mappers');

/**
 * @class ApiListData
 * @extends API
 * @classdesc Use this to list data.
 */

/**
 * @typedef {Object} ApiListError - Error object
 */
module.exports = class ApiListData extends API {

	/**
	 * Get the fields to select from the DB.
	 *
	 * @returns {Array|false|undefined} - The fields to select
	 */
	get fieldsToSelect() {
		return undefined;
	}

	/**
	 * Get the fields to be excluded from the response
	 *
	 * @returns {Array|undefined} - The fields to be excluded
	 */
	get fieldsToExclude() {
		return undefined;
	}

	/**
	 * Get the fixed fields, this are fields that can't be removed from responses
	 *
	 * @returns {Array|undefined} - The fixed fields
	 */
	get fixedFields() {
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
	 * Get the custom query parameters.
	 *
	 * @returns {Array} - The custom query parameters struct.
	 */
	get customParameters() {
		return [];
	}

	/**
	 * Get the max page size.
	 *
	 * @returns {Integer} - The page size.
	 */
	get maxPageSize() {
		return 0;
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

		this.fields = new Fields(this.fieldsToSelect, this.fieldsToExclude, this.fixedFields);
		this.filter = new Filter(requestFilters, this.availableFilters, this.searchFilters, this.staticFilters);
		this.paging = new Paging(this.headers, (this.session && this.session.isService), this.maxPageSize);
		this.sort = new Sort(this.data, this.sortableFields);
		this.customParameter = new CustomParameter(this.data, this.customParameters);

		try {

			this.sort.validate();

			const listDataStruct = struct({
				...this.fields.struct(),
				...this.filter.struct(),
				...this.sort.struct(),
				...this.customParameter.struct()
			}, {
				...this.filter.defaults(),
				...this.sort.defaults()
			});

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
				...this.fields.getParams(this.dataWithDefaults),
				...this.filter.getParams(this.dataWithDefaults),
				...this.sort.getParams(this.dataWithDefaults),
				...this.paging.getParams(this.headersWithDefaults)
			};

			const formattedSortables = await this.formatSortables(getParams.order);
			const formattedFilters = await this.formatFilters(getParams.filters);

			if(this.isValidObject(formattedSortables))
				getParams.order = formattedSortables;

			if(this.isValidObject(formattedFilters))
				getParams.filters = formattedFilters;

			this.shouldReturnTotal = this.shouldCalculateTotals() || this.shouldCalculateOnlyTotals();
			this.shouldReturnBody = !this.shouldCalculateOnlyTotals();

			const { result, total } = await this.fetchData(getParams);

			const rows = await this.formatRows(result);

			if(this.shouldReturnBody)
				this.setBody(rows);

			if(this.shouldReturnTotal)
				this.setHeader(TOTAL_HEADER, total);

		} catch(e) {
			throw new ApiListError(e, ApiListError.codes.INTERNAL_ERROR);
		}
	}

	isValidObject(value) {
		return value && typeof value === 'object';
	}

	/**
	 * Get the data with client params
	 *
	 * @async
	 * @throws {Object} - Params to fetch data
	 * @returns {Object{result, total}} - The result and total data obtained
	 */
	async fetchData(getParams) {

		const data = {};
		if(this.shouldReturnBody) {

			data.result = await this.model.get(getParams);

			if(this.shouldReturnTotal && !data.result.length) {

				data.total = 0;

				return data;

			}
		}


		if(this.shouldReturnTotal) {

			const { total } = await this.model.getTotals(getParams.filters);
			data.total = total;

		}
		return data;
	}

	shouldCalculateOnlyTotals() {
		return booleanMapper(this.headersWithDefaults[CALCULATE_ONLY_TOTALS_HEADER]);
	}

	shouldCalculateTotals() {
		return booleanMapper(this.headersWithDefaults[CALCULATE_TOTALS_HEADER]);
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

	/**
	 * Is used to programatically alter the sortables. It will be executed after parsing static and dynamic sortables.
	 * This method is used to format the sortables before sending to the DB.
	 * @param {Object} sortables - The sortables to format
	 * @returns {Object} - The formatted sortables
	 */
	formatSortables() {}

};
