'use strict';

const { struct } = require('@janiscommerce/superstruct');

const { PAGE_HEADER, PAGE_SIZE_HEADER, CALCULATE_TOTALS_HEADER } = require('./headers');

const DEFAULT_PAGE = 1;

const DEFAULT_PAGE_SIZE = 60;

const MAX_PAGE_SIZE = 100;

const SERVICE_MAX_PAGE_SIZE = 1000;

const isPositiveInteger = number => {
	number = Number(number);
	return !Number.isNaN(number) && number > 0 && number === parseInt(number, 10);
};

const isValidPageSize = (number, maxPageSize) => Number(number) <= maxPageSize;

module.exports = class ListPaging {

	constructor(headers, isService, maxPageSize) {
		this.headers = headers;
		this.maxPageSize = maxPageSize || (isService ? SERVICE_MAX_PAGE_SIZE : MAX_PAGE_SIZE);
	}

	struct() {

		return {
			[PAGE_HEADER]: struct.optional(struct.function(value => isPositiveInteger(value) || 'Page number should be positive')),
			[PAGE_SIZE_HEADER]: struct.optional(struct.function(value => {
				if(isPositiveInteger(value) && isValidPageSize(value, this.maxPageSize))
					return true;

				return `Page size should be a positive integer lesser or equal to ${this.maxPageSize}`;
			})),
			[CALCULATE_TOTALS_HEADER]: 'boolean'
		};
	}

	defaults() {
		return {
			[PAGE_HEADER]: DEFAULT_PAGE,
			[PAGE_SIZE_HEADER]: DEFAULT_PAGE_SIZE,
			[CALCULATE_TOTALS_HEADER]: true
		};
	}

	getParams(clientHeadersWithDefaults) {
		return {
			page: Number(clientHeadersWithDefaults[PAGE_HEADER]),
			limit: Number(clientHeadersWithDefaults[PAGE_SIZE_HEADER])
		};
	}
};
