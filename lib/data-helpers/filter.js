'use strict';

const { struct } = require('superstruct');

class ListFilter {

	constructor(requestFilters, availableFilters, searchFilters) {
		this.requestFilters = requestFilters;
		this.searchFilters = searchFilters || [];
		this.availableFilters = availableFilters.map(filter => {
			return typeof filter === 'object' ? filter : { name: filter };
		});
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

		const filtersParams = [
			...this.getParamsFromAvailableFilters(clientFiltersWithDefaults),
			...this.getParamsFromSearchFilters(clientFiltersWithDefaults)
		];

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
		}, {});

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
}

module.exports = ListFilter;
