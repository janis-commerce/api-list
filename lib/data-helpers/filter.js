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

			const filterValue = filter.valueMapper ? filter.valueMapper(clientFiltersWithDefaults[filter.name]) : clientFiltersWithDefaults[filter.name];

			return {
				filters: {
					...filters,
					[filter.internalName || filter.name]: filterValue
				}
			};
		}, {});
	}

}

module.exports = ListFilter;
