'use strict';

const { struct } = require('@janiscommerce/superstruct');
const ApiListError = require('../api-list-error');

const mapperFilter = require('../helpers/mapper-filter');

const apiFilterStruct = {
	availableFilters: ['string|object'],
	searchFilters: ['string'],
	staticFilters: 'object'
};
module.exports = class ListFilter {

	constructor(requestFilters, availableFilters, searchFilters, staticFilters) {

		this.validateApiFilters({ availableFilters, searchFilters, staticFilters });

		this.requestFilters = requestFilters;
		this.searchFilters = searchFilters;
		this.staticFilters = staticFilters;
		this.availableFilters = availableFilters.map(filter => {
			return typeof filter === 'object' ? filter : { name: filter };
		});
	}

	validateApiFilters(filters) {

		try {
			struct(apiFilterStruct)(filters);
		} catch(error) {
			throw new ApiListError(error, ApiListError.codes.INVALID_FILTERS);
		}
	}

	struct() {

		const filters = [...this.availableFilters];

		if(this.requestFilters.search && this.searchFilters.length)
			filters.push({ name: 'search' });

		if(!filters.length)
			return {};

		const filterStruct = {};

		for(const filter of filters)
			filterStruct[filter.name] = struct.optional('string | number | array | object');

		return {
			filters: struct.optional(filterStruct)
		};
	}

	defaults() {
		return {
			filters: {}
		};
	}

	getParams({ filters: clientFiltersWithDefaults }) {

		const availableFilters = this.getParamsFromAvailableFilters(clientFiltersWithDefaults);
		const searchFilters = this.getParamsFromSearchFilters(clientFiltersWithDefaults);

		const filtersParams = this.mergeParams(searchFilters, availableFilters);

		if(!filtersParams.length)
			return {};

		return {
			filters: filtersParams.length === 1 ? filtersParams[0] : filtersParams
		};
	}

	getParamsFromAvailableFilters(clientFiltersWithDefaults) {

		return this.availableFilters.filter(filter => {
			return clientFiltersWithDefaults[filter.name] !== undefined;
		}).reduce((filters, filter) => {

			const originalValue = clientFiltersWithDefaults[filter.name];

			const filterValue = mapperFilter(originalValue, filter.valueMapper);

			if(filterValue === undefined)
				return filters;

			const internalName = filter.internalName || filter.name;

			const finalName = typeof internalName === 'function' ? internalName(filter, filterValue, originalValue) : internalName;

			return {
				...filters,
				[finalName]: filterValue
			};
		}, {});
	}

	getParamsFromSearchFilters({ search: searchOriginalValues } = {}) {

		if(!searchOriginalValues)
			return [];

		const searchValues = searchOriginalValues.split(' ');

		return this.searchFilters.map(filter => {
			return searchValues.map(value => ({ [filter]: { type: 'search', value } }));
		}).flat();
	}

	mergeParams(searchFilters, availableFilters) {

		if(!searchFilters.length) {
			const otherFilters = { ...availableFilters, ...this.staticFilters };
			return Object.keys(otherFilters).length ? [otherFilters] : [];
		}

		return searchFilters.map(searchFilter => {

			return {
				...availableFilters,
				...searchFilter,
				...this.staticFilters
			};
		});
	}
};
