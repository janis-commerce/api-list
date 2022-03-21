'use strict';

const { struct } = require('@janiscommerce/superstruct');
const ApiListError = require('../api-list-error');

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
		}).reduce((parameters, params) => {

			const originalValue = customParameters[params.name];

			const filterValue = this.applyFilter(originalValue, params.valueMapper);

			const internalName = params.internalName || params.name;

			const finalName = typeof internalName === 'function' ? internalName(params, filterValue, originalValue) : internalName;

			return {
				...parameters,
				[finalName]: filterValue
			};
		}, {});
	}

	applyFilter(originalValue, valueMapper) {

		if(!valueMapper)
			return originalValue;

		if(valueMapper.isCustom)
			return valueMapper.map(originalValue);

		return Array.isArray(originalValue) ? originalValue.map(valueMapper) : valueMapper(originalValue);
	}

	struct(formattedParameters) {

		if(!formattedParameters)
			return {};

		const customParameterStruct = {};

		for(const [key] of Object.entries(formattedParameters))
			customParameterStruct[key] = struct.optional('string | number | array | object | boolean');

		return Object.keys(formattedParameters).reduce((parameter, key) => {
			parameter[key] = customParameterStruct[key];
			return parameter;
		}, {});
	}
};
