'use strict';

const path = require('path');
const { API } = require('@janiscommerce/api');
const { struct } = require('@janiscommerce/superstruct');
const { EJSON } = require('bson');

const EndpointParser = require('./helpers/endpoint-parser');

const ApiListError = require('./api-list-error');

const {
	Fields, Filter, Paging, Sort, CustomParameter
} = require('./data-helpers');

const {
	TOTAL_HEADER,
	CALCULATE_TOTALS_HEADER,
	CALCULATE_ONLY_TOTALS_HEADER,
	RETURN_ONLY_PARAMS_HEADER
} = require('./data-helpers/headers');

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
	 * Set to true if you want the formatter to be called even when response fields are being reduced
	 *
	 * @returns {boolean} - Whether or not call the formatter no matter what
	 */
	get alwaysCallFormatter() {
		return false;
	}

	get getParams() {
		return this._getParams;
	}

	set getParams(params) {
		this._getParams = params;
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
		this.paging = new Paging(this.headers, this.session?.isService, this.maxPageSize);
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

			this.shouldReturnTotal = (this.shouldCalculateTotals() || this.shouldCalculateOnlyTotals()) && !this.shouldReturnOnlyParams();
			this.shouldReturnBody = !this.shouldCalculateOnlyTotals() && !this.shouldReturnOnlyParams();

			this.getParams = {
				...this.fields.getParams(this.dataWithDefaults),
				...this.filter.getParams(this.dataWithDefaults),
				...this.sort.getParams(this.dataWithDefaults),
				...this.paging.getParams(this.headersWithDefaults)
			};

			const formattedSortables = await this.formatSortables(this.getParams.order);

			if(this.isValidObject(formattedSortables))
				this.getParams.order = formattedSortables;

			const formattedFilters = await this.formatFilters(this.getParams.filters, this.getParams);

			if(this.isValidObject(formattedFilters))
				this.getParams.filters = formattedFilters;

			// this.noResults = true could be set in formatFilters() to avoid fetching data/totals

			if(this.shouldReturnOnlyParams())
				return this.setBody({ params: EJSON.stringify(this.getParams), noResults: !!this.noResults });

			if(this.noResults)
				return this.setHeader(TOTAL_HEADER, 0).setBody([]);

			const totalsLimit = this.paging.getTotalsLimit(this.headersWithDefaults);
			const { result, total } = await this.fetchData(this.getParams, totalsLimit);

			if(this.shouldReturnBody) {
				const rows = this.shouldCallFormatter(this.dataWithDefaults) ? await this.formatRows(result) : result;
				this.setBody(rows);
			}

			if(Number.isInteger(total))
				this.setHeader(TOTAL_HEADER, total);

		} catch(e) {
			throw new ApiListError(e, ApiListError.codes.INTERNAL_ERROR);
		}
	}

	shouldCallFormatter(dataWithDefaults) {
		return this.alwaysCallFormatter || !this.fields.isResponseReduced(dataWithDefaults);
	}

	isValidObject(value) {
		return value && typeof value === 'object';
	}

	/**
	 * Get the data with client params
	 *
	 * @async
	 * @param {Object} getParams - Params to fetch data
	 * @param {number|boolean} totalsLimit - Limit for getTotals when using x-janis-totals or x-janis-only-totals with max=X format
	 * @returns {Promise<{result: Array?, total: number?}>} - The result and total data obtained
	 */
	async fetchData(getParams, totalsLimit) {

		const data = {};

		if(this.shouldReturnBody) {

			data.result = await this.model.get(getParams);

			// If result count is less than pageSize in the first page, set total to result length to avoid a second request to fetch totals
			if(getParams.page === 1 && data.result.length < getParams.limit) {

				data.total = data.result.length;

				return data;
			}
		} else
			data.result = [];

		if(this.shouldReturnTotal) {
			const getTotalsOptions = Number.isInteger(totalsLimit) ? { limit: totalsLimit } : undefined;
			const { total } = await this.model.getTotals(getParams.filters || {}, getTotalsOptions);
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

	shouldReturnOnlyParams() {
		return this.session?.isService && booleanMapper(this.headersWithDefaults[RETURN_ONLY_PARAMS_HEADER]);
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
	 * @returns {Array|Promise<Array>} - The formatted rows
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
