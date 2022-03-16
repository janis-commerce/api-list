'use strict';

const { struct } = require('@janiscommerce/superstruct');

module.exports = class ListCustomParameters {

	constructor(requestParameters, customParameters) {
		this.requestParameters = requestParameters;
		this.customParameters = customParameters;
	}

	struct() {

		const customParameter = this.customParameters;


		if(!customParameter.length)
			return {};

		return {
			[customParameter]: struct.optional('string')
		};
	}
};
