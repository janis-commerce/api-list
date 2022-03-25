'use strict';

const { struct } = require('@janiscommerce/superstruct');
const ApiListError = require('../api-list-error');

const mapperFilter = require('../helpers/mapper-filter');

const apiCustomParameterStruct = {
	customParameters: ['string|object']
};

const apiReservedParams = [
	'filters',
	'sortBy',
	'sortDirection'
];

module.exports = class ListCustomParameters {

	constructor(requestParameters, customParameters) {

		this.requestParameters = requestParameters;
		this.customParameters = customParameters;
	}

	format() {

		try {

			struct(apiCustomParameterStruct)({ customParameters: this.customParameters });

			this.customParameters = this.customParameters.reduce((formattedParameters, parameter) => {

				parameter = typeof parameter === 'object' ? parameter : { name: parameter };

				if(apiReservedParams.includes(parameter.name))
					throw new Error(`The custom parameter name "${parameter.name}" is a reserved parameter name.`);

				if(this.requestParameters[parameter.name] === undefined)
					return formattedParameters;

				this.requestParameters[parameter.name] = mapperFilter(this.requestParameters[parameter.name], parameter.valueMapper);

				formattedParameters.push(parameter);
				return formattedParameters;
			}, []);

		} catch(error) {
			throw new ApiListError(error, ApiListError.codes.INVALID_PARAMETERS);
		}
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
