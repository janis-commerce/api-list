'use strict';

const { struct } = require('@janiscommerce/superstruct');

const {
	PAGE_HEADER, PAGE_SIZE_HEADER, CALCULATE_TOTALS_HEADER, CALCULATE_ONLY_TOTALS_HEADER, RETURN_ONLY_PARAMS_HEADER
} = require('./headers');

const { booleanMapper } = require('../filter-mappers');

const DEFAULT_PAGE = 1;

const DEFAULT_PAGE_SIZE = 60;

const MAX_PAGE_SIZE = 100;

const SERVICE_MAX_PAGE_SIZE = 1000;

const totalLimitRegex = /^max=(\d+)$/;

const isPositiveInteger = number => {
	number = Number(number);
	return !Number.isNaN(number) && number > 0 && number === parseInt(number, 10);
};

const isValidPageSize = (number, maxPageSize) => Number(number) <= maxPageSize;

/**
 * Parse the totals header value. If max=X format is used, return the limit. Otherwise, fallback to boolean mapper for backward compatibility.
 *
 * @param {string|boolean} value
 * @returns {number|boolean} - The limit or boolean value
 */
const parseTotalsHeader = value => {
	if(typeof value === 'string') {
		const maxMatch = value.match(totalLimitRegex);
		if(maxMatch) {
			const limit = Number(maxMatch[1]);
			if(limit > 0)
				return limit;
		}
	}

	return booleanMapper(value);
};

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
			[CALCULATE_TOTALS_HEADER]: 'string|boolean', // for all cases like: '1'|'true'|true|'max=100'|'max=5000'|'max=1'
			[CALCULATE_ONLY_TOTALS_HEADER]: 'string|boolean', // for all cases like: '1'|'true'|true|'max=100'|'max=5000'|'max=1'
			[RETURN_ONLY_PARAMS_HEADER]: 'string|boolean' // for all cases like: '1'|'true'|true
		};
	}

	defaults() {
		return {
			[PAGE_HEADER]: DEFAULT_PAGE,
			[PAGE_SIZE_HEADER]: DEFAULT_PAGE_SIZE,
			[CALCULATE_TOTALS_HEADER]: false,
			[CALCULATE_ONLY_TOTALS_HEADER]: false,
			[RETURN_ONLY_PARAMS_HEADER]: false
		};
	}

	getParams(clientHeadersWithDefaults) {
		return {
			page: Number(clientHeadersWithDefaults[PAGE_HEADER]),
			limit: Number(clientHeadersWithDefaults[PAGE_SIZE_HEADER])
		};
	}

	/**
	 * @param {Record<string, string>} clientHeadersWithDefaults
	 * @returns {number|boolean} - The limit or boolean value (true for all records, false for no totals)
	 */
	getTotalsLimit(clientHeadersWithDefaults) {

		const onlyTotalsValue = clientHeadersWithDefaults[CALCULATE_ONLY_TOTALS_HEADER];
		if(onlyTotalsValue) {
			const parsedValue = parseTotalsHeader(onlyTotalsValue);
			if(parsedValue)
				return parsedValue;
		}

		const totalsValue = clientHeadersWithDefaults[CALCULATE_TOTALS_HEADER];
		if(totalsValue) {
			const parsedValue = parseTotalsHeader(totalsValue);
			if(parsedValue)
				return parsedValue;
		}

		return false;
	}

};
