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
			[SORT_PARAMETER]: struct.optional(struct.dynamic(value => {

				if(value instanceof Array) {

					if(value.length > 3)
						throw new Error('Maximum amount of field to sort is 3');

					return struct([struct.enum(this.sortableFields)]);
				}

				return struct(struct.enum(this.sortableFields));
			})),
			[SORT_DIRECTION_PARAMETER]: struct.optional(struct.dynamic(value => {

				if(value instanceof Array) {

					if(this.isString(this.requestParameters[SORT_PARAMETER]))
						throw new Error('The field sortDirection must be string when sortBy is string');

					return struct([struct.enum([...sortDirections, undefined])]);
				}

				return struct(struct.enum(sortDirections));
			}))
		};
	}

	defaults() {
		return {
			[SORT_DIRECTION_PARAMETER]: currentValues => currentValues[SORT_PARAMETER] && DEFAULT_SORT_DIRECTION
		};
	}

	getParams(clientParamsWithDefaults) {

		const sortParameters = clientParamsWithDefaults[SORT_PARAMETER];
		const sortDirection = clientParamsWithDefaults[SORT_DIRECTION_PARAMETER];

		if(!sortParameters || !sortParameters.length)
			return {};

		const sanitizedSortDirection = this.sanitizeSortDirection(sortDirection);

		if(this.isString(sortParameters)) {
			return {
				order: {
					[sortParameters]: sanitizedSortDirection
				}
			};
		}

		return sortParameters.reduce((accumOfParam, param, index) => {

			accumOfParam.order[param] = sortDirection instanceof Array && sortDirection[index] ? sanitizedSortDirection[index] : DEFAULT_SORT_DIRECTION;

			return accumOfParam;
		}, {
			order: {}
		});
	}

	sanitizeSortDirection(sortDirection) {

		if(this.isString(sortDirection))
			return sortDirection.toLowerCase();

		return sortDirection.map(direction => direction && direction.toLowerCase());
	}

	isString(value) {
		return typeof value === 'string';
	}

}

module.exports = ListSort;
