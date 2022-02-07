'use strict';

const { struct } = require('@janiscommerce/superstruct');

const SORT_PARAMETER = 'sortBy';
const SORT_DIRECTION_PARAMETER = 'sortDirection';

const DEFAULT_SORT_DIRECTION = 'asc';

const sortDirections = ['asc', 'desc', 'ASC', 'DESC', undefined];

class ListSort {

	constructor(requestParameters, sortableFields) {
		this.requestParameters = requestParameters;
		this.sortableFields = sortableFields;
	}

	struct() {

		if(!this.sortableFields.length)
			return {};

		return {
			[SORT_PARAMETER]: struct.optional(struct.dynamic(value => struct(value instanceof Array ?
				[struct.enum(this.sortableFields)] :
				struct.enum(this.sortableFields)))),
			[SORT_DIRECTION_PARAMETER]: struct.optional(struct.dynamic(value => struct(value instanceof Array ?
				[struct.enum(sortDirections)] :
				struct.enum(sortDirections))))
		};
	}

	defaults() {
		return {
			[SORT_DIRECTION_PARAMETER]: currentValues => currentValues[SORT_PARAMETER] && DEFAULT_SORT_DIRECTION
		};
	}

	getParams(clientParamsWithDefaults) {

		const sortParameters = clientParamsWithDefaults[SORT_PARAMETER];

		if(!sortParameters)
			return {};

		const response = {
			order: {}
		};

		if(typeof sortParameters === 'string') {
			response.order[clientParamsWithDefaults[SORT_PARAMETER]] = clientParamsWithDefaults[SORT_DIRECTION_PARAMETER].toLowerCase();
			return response;
		}

		return sortParameters.reduce((accumOfParam, param, index) => {

			const sortDirection = clientParamsWithDefaults[SORT_DIRECTION_PARAMETER];

			accumOfParam.order[param] = sortDirection instanceof Array && sortDirection[index] ? sortDirection[index].toLowerCase() : DEFAULT_SORT_DIRECTION;

			return accumOfParam;
		}, response);
	}

}

module.exports = ListSort;
