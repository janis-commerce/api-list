'use strict';

const { struct } = require('@janiscommerce/superstruct');
const ApiListError = require('../api-list-error');

const mapperFilter = require('../helpers/mapper-filter');

const apiCustomParameterStruct = {
	customParameters: ['string|object']
};

module.exports = class ListCustomParameters {

	constructor(requestParameters, customParameters) {

		this.requestParameters = requestParameters;
		this.customParameters = customParameters.map(customParameter => {
			return typeof customParameter === 'object' ? customParameter : { name: customParameter };
		});
	}

	validate() {

		try {

			struct(apiCustomParameterStruct)({ customParameters: this.customParameters });

			const reservedWords = ['filters', 'sortBy', 'sortDirection'];

			this.customParameters.forEach(customParameter => {
				if(reservedWords.includes(customParameter.name))
					throw new Error(`The custom parameter name "${customParameter.name}" is reserved word`);
			});

		} catch(error) {
			throw new ApiListError(error, ApiListError.codes.INVALID_PARAMETERS);
		}
	}

	format() {

		this.validate();

		return this.customParameters.filter(params => {
			return this.requestParameters[params.name] !== undefined;
		}).forEach(params => {
			this.requestParameters[params.name] = mapperFilter(this.requestParameters[params.name], params.valueMapper);
		});
	}

	struct() {

		if(!this.customParameters.length)
			return {};

		return this.customParameters.reduce((customParameter, parameter) => {
			customParameter[parameter.name] = struct.optional('string | number | boolean | array | object');
			return customParameter;
		}, {});
	}
};
