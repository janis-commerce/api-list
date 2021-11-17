'use strict';

const startAndEndOfDayFilterMapperDeprecation = require('./deprecations/start-and-end-of-day-filter-mapper');

/**
 * Maps a filter value to a boolean
 *
 * @param {any} value The value
 * @return {boolean} The value as boolean
 */
const booleanMapper = value => !(value === 'false' || value === '0' || !value);

/**
 * Maps a filter value to a date object
 *
 * @param {string} date The date as string
 * @return {Date} The date object
 */
const dateMapper = date => new Date(date);

/**
 * Maps a filter value to a date object at the start of the day
 *
 * @deprecated
 * @param {string} date The date as string
 * @return {Date} The date object
 */
const startOfTheDayMapper = date => new Date(new Date(date).setHours(0, 0, 0, 0));

/**
 * Maps a filter value to a date object at the end of the day
 *
 * @deprecated
 * @param {string} date The date as string
 * @return {Date} The date object
 */
const endOfTheDayMapper = date => new Date(new Date(date).setHours(23, 59, 59, 999));

/**
 * Maps a type and a value to a filter with those params. It's a currified function.
 *
 * @param {string} type The filter type
 * @return {object} A function that maps the filter value to an object setting the type received as param
 *
 * @example
 * {
 *  name: 'idIsNot',
 *  internalName: 'id',
 *  valueMapper: customTypeMapper('notEqual')
 * }
 */
const customTypeMapper = type => ({
	isCustom: true,
	map: value => ({ type, value })
});
/**
 * Maps a filter value to an object setting the type as 'search'
 *
 * @param {any} value The value
 * @return {object} The value with type = search
 */
const searchMapper = customTypeMapper('search');

module.exports = {
	booleanMapper,
	dateMapper,
	startOfTheDayMapper: startAndEndOfDayFilterMapperDeprecation(startOfTheDayMapper),
	endOfTheDayMapper: startAndEndOfDayFilterMapperDeprecation(endOfTheDayMapper),
	customTypeMapper,
	searchMapper
};
