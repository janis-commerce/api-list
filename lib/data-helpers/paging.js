'use strict';

const { struct } = require('superstruct');

const PAGE_HEADER = 'x-janis-page';

const PAGE_SIZE_HEADER = 'x-janis-page-size';

const DEFAULT_PAGE = 1;

const DEFAULT_PAGE_SIZE = 60;

const MAX_PAGE_SIZE = 100;

const SERVICE_MAX_PAGE_SIZE = 1000;

const isPositiveInteger = number => {
	number = Number(number);
	return !Number.isNaN(number) && number > 0 && number === parseInt(number, 10);
};

const isValidPageSize = (number, isService) => {
	return Number(number) <= (isService ? SERVICE_MAX_PAGE_SIZE : MAX_PAGE_SIZE);
};

module.exports = class ListPaging {

	constructor(headers, isService) {
		this.headers = headers;
		this.isService = !!isService;
	}

	struct() {

		return {
			[PAGE_HEADER]: struct.optional(struct.function(value => isPositiveInteger(value) || 'Page number should be positive')),
			[PAGE_SIZE_HEADER]: struct.optional(struct.function(value => {
				if(isPositiveInteger(value) && isValidPageSize(value, this.isService))
					return true;

				return `Page size should be a positive integer lesser or equal to ${MAX_PAGE_SIZE}`;
			}))
		};
	}

	defaults() {
		return {
			[PAGE_HEADER]: DEFAULT_PAGE,
			[PAGE_SIZE_HEADER]: DEFAULT_PAGE_SIZE
		};
	}

	getParams(clientHeadersWithDefaults) {
		return {
			page: Number(clientHeadersWithDefaults[PAGE_HEADER]),
			limit: Number(clientHeadersWithDefaults[PAGE_SIZE_HEADER])
		};
	}
};
