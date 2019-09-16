'use strict';

const { struct } = require('superstruct');

const PAGE_HEADER = 'x-janis-page';

const PAGE_SIZE_HEADER = 'x-janis-page-size';

const DEFAULT_PAGE = 1;

const DEFAULT_PAGE_SIZE = 60;

const isPositiveInteger = number => {
	number = Number(number);
	return !Number.isNaN(number) && number > 0 && number === parseInt(number, 10);
};

class ListPaging {

	constructor(headers) {
		this.headers = headers;
	}

	struct() {

		return {
			[PAGE_HEADER]: struct.optional(struct.function(value => isPositiveInteger(value) || 'Page number should be positive')),
			[PAGE_SIZE_HEADER]: struct.optional(struct.function(value => isPositiveInteger(value) || 'Page size should be positive'))
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

}

module.exports = ListPaging;
