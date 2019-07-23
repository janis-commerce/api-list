'use strict';

const ApiListError = require('../api-list-error');
const camelize = require('../utils/camelize');

class EndpointParser {

	static parse(endpoint) {

		if(!endpoint)
			throw new ApiListError('Endpoint not set.', ApiListError.codes.INTERNAL_ERROR);

		const sanitizedEndpoint = endpoint.replace(/^\/?(api\/)?/i, '');

		if(!sanitizedEndpoint)
			throw new ApiListError('Invalid Rest endpoint.', ApiListError.codes.INVALID_REQUEST_DATA);

		const sanitizedEndpointParts = sanitizedEndpoint.split('/');

		const partsQuantity = sanitizedEndpointParts.length;

		if((partsQuantity % 2) === 0)
			throw new ApiListError('Invalid List endpoint.', ApiListError.codes.INVALID_REQUEST_DATA);

		let modelName;
		const parents = {};

		for(let i = 0; i < partsQuantity; i += 2) {
			if(i + 1 < partsQuantity)
				parents[camelize(sanitizedEndpointParts[i].toLowerCase())] = sanitizedEndpointParts[i + 1];
			else
				modelName = sanitizedEndpointParts[i].toLowerCase();
		}

		return {
			modelName,
			parents
		};
	}

}

module.exports = EndpointParser;
