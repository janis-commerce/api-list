'use strict';

const { struct } = require('superstruct');

class ListFilter {

	constructor(requestFilters, availableFilters) {
		this.requestFilters = requestFilters;
		this.availableFilters = availableFilters.map(filter => {
			return typeof filter === 'object' ? filter : { name: filter };
		});
	}

	struct() {

		if(!this.availableFilters.length)
			return {};

		const filterStruct = {};

		for(const filter of this.availableFilters)
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

		return this.availableFilters.filter(filter => {
			return clientFiltersWithDefaults[filter.name] !== undefined;
		}).reduce(({ filters }, filter) => {

			const originalValue = clientFiltersWithDefaults[filter.name];

			const filterValue = filter.valueMapper ? filter.valueMapper(originalValue) : originalValue;

			const internalName = filter.internalName || filter.name;

			const finalName = typeof internalName === 'function' ? internalName(filter, filterValue, originalValue) : internalName;

			return {
				filters: {
					...filters,
					[finalName]: filterValue
				}
			};
		}, {});
	}

}

module.exports = ListFilter;
