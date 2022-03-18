'use strict';

const isObject = require('../helpers/is-object');

module.exports = class ListCustomParameters {

	constructor(requestParameters, customParameters) {
		this.requestParameters = requestParameters;
		this.customParameters = customParameters;
	}

	validate() {

		if(!isObject(this.customParameters))
			throw new Error('The custom parameter must be an object');
	}

	struct() {
		return this.customParameters;
	}

};
