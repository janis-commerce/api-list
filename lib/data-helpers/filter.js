'use strict';

const { struct } = require('superstruct');
const ApiListError = require('../api-list-error');

const apiFilterStruct = {
	availableFilters: ['string|object'],
	searchFilters: ['string'],
	staticFilters: 'object'
};
class ListFilter {

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
			filterStruct[filter.name] = struct.optional('string | number | array');

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

		const availableFiltersParams = this.availableFilters.filter(filter => {
			return clientFiltersWithDefaults[filter.name] !== undefined;
		}).reduce((filters, filter) => {

			const originalValue = clientFiltersWithDefaults[filter.name];

			const filterValue = filter.valueMapper ? filter.valueMapper(originalValue) : originalValue;

			const internalName = filter.internalName || filter.name;

			const finalName = typeof internalName === 'function' ? internalName(filter, filterValue, originalValue) : internalName;

			return {
				...filters,
				[finalName]: filterValue
			};
		}, { ...this.staticFilters });

		return Object.keys(availableFiltersParams).length ? [availableFiltersParams] : [];
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

		const [otherFilters] = availableFilters;

		if(!searchFilters.length)
			return availableFilters;

		return searchFilters.map(searchFilter => {

			return {
				...otherFilters,
				...searchFilter,
				...this.staticFilters
			};
		});
	}
}

module.exports = ListFilter;
