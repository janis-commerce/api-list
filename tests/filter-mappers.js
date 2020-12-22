'use strict';

const assert = require('assert');

const {
	FilterMappers: {
		booleanMapper,
		dateMapper,
		startOfTheDayMapper,
		endOfTheDayMapper,
		searchMapper,
		customTypeMapper
	}
} = require('..');

describe('Filter mappers', () => {

	describe('booleanMapper', () => {

		it('Should convert string 0 to false', () => {
			assert.strictEqual(booleanMapper('0'), false);
		});

		it('Should convert string false to false', () => {
			assert.strictEqual(booleanMapper('false'), false);
		});

		it('Should convert empty string to false', () => {
			assert.strictEqual(booleanMapper(''), false);
		});

		it('Should convert boolean false to false', () => {
			assert.strictEqual(booleanMapper(false), false);
		});

		it('Should convert number zero to false', () => {
			assert.strictEqual(booleanMapper(0), false);
		});

		it('Should convert any other value to true', () => {
			assert.strictEqual(booleanMapper('1'), true);
			assert.strictEqual(booleanMapper('true'), true);
			assert.strictEqual(booleanMapper('foo'), true);
			assert.strictEqual(booleanMapper(true), true);
			assert.strictEqual(booleanMapper(1), true);
			assert.strictEqual(booleanMapper([]), true);
			assert.strictEqual(booleanMapper(['foo']), true);
			assert.strictEqual(booleanMapper({ foo: 'bar' }), true);
		});

	});

	describe('dateMapper', () => {

		it('Should return a date object with the given date', () => {
			assert.deepStrictEqual(dateMapper('2020-02-27T14:23:44.963Z'), new Date('2020-02-27T14:23:44.963Z'));
		});

	});

	describe('startOfTheDayMapper', () => {

		it('Should return a date object with the given date but at 00:00:00.000', () => {
			assert.deepStrictEqual(startOfTheDayMapper('2020-02-27T14:23:44.963Z'), new Date('2020-02-27T00:00:00.000Z'));
		});

	});

	describe('endOfTheDayMapper', () => {

		it('Should return a date object with the given date but at 23:59:59.999', () => {
			assert.deepStrictEqual(endOfTheDayMapper('2020-02-27T14:23:44.963Z'), new Date('2020-02-27T23:59:59.999Z'));
		});

	});

	describe('searchMapper', () => {

		it('Should return an object with type search and the passed value', () => {

			assert.deepStrictEqual(searchMapper.map('myValue'), {
				type: 'search',
				value: 'myValue'
			});

			assert.deepStrictEqual(searchMapper.map({ foo: 'bar' }), {
				type: 'search',
				value: { foo: 'bar' }
			});

			assert.deepStrictEqual(searchMapper.map(['foo']), {
				type: 'search',
				value: ['foo']
			});

			assert.deepStrictEqual(searchMapper.map(false), {
				type: 'search',
				value: false
			});
		});

	});

	describe('customTypeMapper', () => {

		it('Should create a mapper with the given type', () => {
			const notEqualMapper = customTypeMapper.map('notEqual');

			assert.deepStrictEqual(notEqualMapper('myValue'), {
				type: 'notEqual',
				value: 'myValue'
			});

			const greaterOrEqualMapper = customTypeMapper.map('greaterOrEqual');

			assert.deepStrictEqual(greaterOrEqualMapper(10), {
				type: 'greaterOrEqual',
				value: 10
			});
		});

	});

});
