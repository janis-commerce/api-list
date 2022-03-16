'use strict';

const { struct } = require('@janiscommerce/superstruct');

const SORT_PARAMETER = 'sortBy';
const SORT_DIRECTION_PARAMETER = 'sortDirection';

const DEFAULT_SORT_DIRECTION = 'asc';

const sortDirections = ['asc', 'desc', 'ASC', 'DESC'];

module.exports = class ListSort {

	constructor(requestParameters, sortableFields) {
		this.requestParameters = requestParameters;
		this.sortableFields = sortableFields;
	}

	struct() {

		if(!this.sortableFields.length)
			return {};

		return {
			[SORT_PARAMETER]: struct.optional(struct.union([[struct.enum(this.sortableFields)], struct.enum(this.sortableFields)])),
			[SORT_DIRECTION_PARAMETER]: struct.optional(struct.union([[struct.enum([...sortDirections, undefined])], struct.enum(sortDirections)]))
		};
	}

	validate() {

		const requestedSortParameters = this.requestParameters[SORT_PARAMETER];

		if(requestedSortParameters instanceof Array && requestedSortParameters.length > 3)
			throw new Error('Maximum amount of field to sort is 3');
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

			if(sanitizedSortDirection instanceof Array && sanitizedSortDirection[0]) {
				return {
					order: {
						[sortParameters]: sanitizedSortDirection[0]
					}
				};
			}

			return {
				order: {
					[sortParameters]: this.isString(sanitizedSortDirection) ? sanitizedSortDirection : DEFAULT_SORT_DIRECTION
				}
			};
		}

		return sortParameters.reduce((accumOfFields, param, index) => {

			if(this.isString(sortDirection)) {
				accumOfFields.order[param] = sortDirection;
				return accumOfFields;
			}

			accumOfFields.order[param] = sortDirection instanceof Array && sortDirection[index] ? sanitizedSortDirection[index] : DEFAULT_SORT_DIRECTION;

			return accumOfFields;
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
};
