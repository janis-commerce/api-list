# API List

[![Build Status](https://travis-ci.org/janis-commerce/api-list.svg?branch=master)](https://travis-ci.org/janis-commerce/api-list)
[![Coverage Status](https://coveralls.io/repos/github/janis-commerce/api-list/badge.svg?branch=master)](https://coveralls.io/github/janis-commerce/api-list?branch=master)

A package to handle JANIS List APIs

## Installation

```
npm install @janiscommerce/api-list
```

## Usage

```js
'use strict';

const { ApiListData } = require('@janiscommerce/api-list');

module.exports = class MyApiListData extends ApiListData {

	get fieldsToSelect() {
		return ['id', 'name', 'status'];
	}

	get sortableFields() {
		return [
			'id',
			'status'
		];
	}

	get availableFilters() {
		return [
			'id',
			{
				name: 'quantity',
				valueMapper: Number
			},
			{
				name: 'hasSubProperty',
				internalName: (filterConfiguration, mappedValue, originalValue) => `rootProperty.${originalValue}`,
				valueMapper: () => true
			}
		];
	}

	get searchFilters() {
		return [
			'id',
			'quantity'
		];
	}

	async formatRows(rows) {
		return rows.map(row => ({ ...row, oneMoreField: true }));
	}

};
```

## List APIs with parents

If you have for example, a list API for a sub-entity of one specific record, the parent will be automatically be added as a filter.

**Important:** The parent entity must be listed as an available filter

For example, the following endpoint: `/api/parent-entity/1/sub-entity`, will be a list of the sub-entity, and `parentEntity: '1'` will be set as a filter.

It could be thought as if it's equivalent to the following request: `/api/sub-entity?filters[parentEntity]=1`

## MyApiListData

The following getters and methods can be used to customize and validate your List API.
All of them are optional.

### get fieldsToSelect()
This is used to indicate which fields should be selected from the DB.
This allows you to select fields from other tables, and automatically join them in relational databases.
This fields **must** be defined in the model.

### get sortableFields()
This is used to indicate which fields can be used to sort the list. Any other sort field will return a 400 status code.

### get availableFilters()
This is used to indicate which fields can be used to filter the list. Any other filter will return a 400 status code.
Filters can be customized by passing an object with the following properties:
- `name`: (string) The name of the filter param. This property is required.
- `internalName`: (string|function) The name of the field, as defined in the model. This should not be defined in case it's equal to `name`.
If it's a function (_since 3.1.0_), it must return a string and it will receive the following arguments: `(filterConfiguration, mappedValue, originalValue)`
- `valueMapper`: (function) A function to be called on the filter's value. This is optional.

### async formatRows(rows)
You can use this to format your records before they are returned.
For example, mapping DB friendly values to user friendly values, add default values, translation keys, etc.

## Common filter value mappers

_Since 3.1.0_

This lib also exports some common filter value mappers (to use as `valueMapper` in your `availableFilters` getter) so you don't need to implement them yourself.

They are explained here with examples:

```js
'use strict';

const {
	ApiListData,
	FilterMappers: {
		booleanMapper,
		dateMapper,
		startOfTheDayMapper,
		endOfTheDayMapper,
		searchMapper,
		customTypeMapper
	}
} = require('@janiscommerce/api-list');

module.exports = class MyApiListData extends ApiListData {

	get availableFilters() {
		return [
			{
				name: 'canDoSomething',
				valueMapper: booleanMapper // Maps '0', 'false', '', and false to false. Any other value is mapped to true.
			},
			{
				name: 'someExactDate',
				valueMapper: dateMapper // Maps to a date object
			},
			{
				name: 'dateCreatedDay',
				internalName: 'dateCreatedFrom',
				valueMapper: startOfTheDayMapper // Maps to a date object at the start of the day
			},
			{
				name: 'dateCreatedDay',
				internalName: 'dateCreatedTo',
				valueMapper: endOfTheDayMapper // Maps to a date object at the end of the day
			},
			{
				name: 'name',
				valueMapper: searchMapper // Maps to an object like this: { type: 'search', value }
			},
			{
				name: 'isOlderThan',
				internalName: 'age',
				valueMapper: customTypeMapper('greater') // This returns a mapper like this: value => ({ type: 'greater', value })
			}
		];
	}

};
```

### get searchFilters()
This is used to indicate which fields will be used to mapped multiple filters (OR Type) for the same value, using only `search` as single filter.
If it don't exist or return an empty array and try to use `search` filter will return 400 status code.
Can be combined with other filters.

For example:
```js
'use strict';

const {
	ApiListData
} = require('@janiscommerce/api-list');

module.exports = class MyApiListData extends ApiListData {

	get searchFilters() {
		return ['someField', 'otherField'];
	}
};
```

* `/api/entity?filters[search]=1` with a single value.

Will filter the list for `someField: 1` or `otherField: 1`

* `/api/entity?filters[search]=fo` with a uncomplete word.

Will filter the list for `someField: fo` or `otherField: fo` and will do a parcial filter (like using `searchMapper`).

* `/api/entity?filters[search]=foo bar` with multiples words divided by white spaces.

Will filter the list for `someField: foo` or `someField: bar` or `otherField: foo` or `otherField: bar`.
