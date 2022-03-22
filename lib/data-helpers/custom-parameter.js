'use strict';

const { struct } = require('@janiscommerce/superstruct');
const ApiListError = require('../api-list-error');

const { mapperFilter } = require('../helpers/mapper-filter');

const apiCustomParameterStruct = {
	customParameters: ['string|object']
};

module.exports = class ListCustomParameters {

	constructor(requestParameters, customParameters) {

		this.validate({ customParameters });

		this.requestParameters = requestParameters;
		this.customParameters = customParameters.map(customParameter => {
			return typeof customParameter === 'object' ? customParameter : { name: customParameter };
		});
	}

	validate(customParameters) {

		try {
			struct(apiCustomParameterStruct)(customParameters);
		} catch(error) {
			throw new ApiListError(error);
		}
	}

	formatCustomParameters(customParameters) {

		return this.customParameters.filter(params => {
			return customParameters[params.name] !== undefined;
		}).forEach(params => {

			customParameters[params.name] = mapperFilter(customParameters[params.name], params.valueMapper);
		});
	}

	struct() {

		const customParameters = [...this.customParameters];

		if(!customParameters.length)
			return {};

		return customParameters.reduce((customParameter, parameter) => {
			customParameter[parameter.name] = struct.optional('string | number | boolean | array | object');
			return customParameter;
		}, {});
	}
};
