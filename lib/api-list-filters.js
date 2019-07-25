'use strict';

const { API } = require('@janiscommerce/api');
const path = require('path');

const ApiListError = require('./api-list-error');
const EndpointParser = require('./helpers/endpoint-parser');

class ApiListFilters extends API {

	async validate() {

		this._parseEndpoint();
		this._validateModel();
	}

	async process() {

		try {

			const filters = await this.getFiltersValues();

			this.setBody({
				filters
			});

		} catch(e) {
			throw new ApiListError(e.message, ApiListError.codes.INTERNAL_ERROR);
		}
	}

	async getFiltersValues() {
		throw new Error('Method getFiltersValues should be implemented in your API');
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

module.exports = ApiListFilters;
