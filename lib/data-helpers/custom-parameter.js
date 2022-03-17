'use strict';

const { struct } = require('@janiscommerce/superstruct');

module.exports = class ListCustomParameters {

	constructor(requestParameters, customParameters) {
		this.requestParameters = requestParameters;
		this.customParameters = customParameters;
	}

	struct() {

		if(!this.customParameters.length)
			return {};

		return this.customParameters.reduce((customParameters, parameterName) => {
			customParameters[parameterName] = struct.optional('string');
			return customParameters;
		}, {});
	}
};
