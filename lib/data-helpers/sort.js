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

		const formattedSortableFields = this.sortableFields.map(field => field.name || field);

		return {
			[SORT_PARAMETER]: struct.optional(struct.union([[struct.enum(formattedSortableFields)], struct.enum(formattedSortableFields)])),
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
		const { sortParameters, sortDirection } = this.getSortParameters(clientParamsWithDefaults);

		if(!sortParameters || !sortParameters.length)
			return {};

		return sortParameters.reduce((accumOfFields, param, index) => {
			accumOfFields.order[param] = this.sanitizeSortDirection(sortDirection[index]);

			return accumOfFields;
		}, {
			order: {}
		});
	}


	getSortParameters(clientParamsWithDefaults) {
		const rawSortParameters = clientParamsWithDefaults[SORT_PARAMETER];
		const sortDirection = clientParamsWithDefaults[SORT_DIRECTION_PARAMETER];

		const sortParameters = this.isString(rawSortParameters) ? [rawSortParameters] : rawSortParameters;

		if(!sortParameters || !sortParameters.length)
			return {};

		return sortParameters.reduce((accum, param, idx) => {
			const sortableField = this.sortableFields.find(field => field === param || field.name === param);

			let direction = DEFAULT_SORT_DIRECTION;

			if(this.isString(sortDirection))
				direction = sortDirection;

			if(this.isArray(sortDirection) && sortDirection[idx])
				direction = sortDirection[idx];

			if(sortableField.valueMapper && typeof sortableField.valueMapper === 'function') {
				const sortableFieldMapped = sortableField.valueMapper(sortableField.name);

				if(!this.isArray(sortableFieldMapped))
					return accum;

				sortableFieldMapped.forEach(sortData => {
					if(!this.isArray(sortData))
						return;

					const [sortBy, sortDir = direction] = sortData;

					if(sortBy && this.isString(sortBy)) {
						accum.sortParameters.push(sortBy);
						accum.sortDirection.push(sortDir);
					}
				});

				return accum;
			}

			accum.sortParameters.push(sortableField.name || sortableField);
			accum.sortDirection.push(direction);

			return accum;
		}, { sortParameters: [], sortDirection: [] });
	}

	sanitizeSortDirection(sortDirection) {
		return sortDirection.toLowerCase();
	}

	isArray(value) {
		return value instanceof Array;
	}

	isString(value) {
		return typeof value === 'string';
	}
};
