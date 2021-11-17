'use strict';

const { struct } = require('@janiscommerce/superstruct');

const SORT_PARAMETER = 'sortBy';
const SORT_DIRECTION_PARAMETER = 'sortDirection';

const DEFAULT_SORT_DIRECTION = 'asc';

const sortDirections = ['asc', 'desc', 'ASC', 'DESC'];

class ListSort {

	constructor(requestParameters, sortableFields) {
		this.requestParameters = requestParameters;
		this.sortableFields = sortableFields;
	}

	struct() {

		if(!this.sortableFields.length)
			return {};

		return {
			[SORT_PARAMETER]: struct.optional(struct.enum(this.sortableFields)),
			[SORT_DIRECTION_PARAMETER]: struct.optional(struct.enum(sortDirections))
		};
	}

	defaults() {
		return {
			[SORT_DIRECTION_PARAMETER]: currentValues => currentValues[SORT_PARAMETER] && DEFAULT_SORT_DIRECTION
		};
	}

	getParams(clientParamsWithDefaults) {

		if(!clientParamsWithDefaults[SORT_PARAMETER])
			return {};

		return {
			order: {
				[clientParamsWithDefaults[SORT_PARAMETER]]: clientParamsWithDefaults[SORT_DIRECTION_PARAMETER].toLowerCase()
			}
		};
	}

}

module.exports = ListSort;
