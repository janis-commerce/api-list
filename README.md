# API List

[![Build Status](https://travis-ci.org/janis-commerce/api-list.svg?branch=master)](https://travis-ci.org/janis-commerce/api-list)
[![Coverage Status](https://coveralls.io/repos/github/janis-commerce/api-list/badge.svg?branch=master)](https://coveralls.io/github/janis-commerce/api-list?branch=master)

A package to handle JANIS List APIs

## Installation

```
npm install @janiscommerce/api-list
```

## Usage

- API List Data
```js
'use strict';

const { ApiListData } = require('@janiscommerce/api-list');

class MyApiListData extends ApiListData {

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
				name: 'status',
				valueMapper: Number
			}
		];
	}

	async formatRows(rows) {
		return rows.map(row => ({ ...row, oneMoreField: true }));
	}

}

module.exports = MyApiListData;
```

- API List Filters
```js
'use strict';

const { ApiListFilters } = require('@janiscommerce/api-list');

class MyApiListFilters extends ApiListFilters {

	get getFiltersValues() {
		return {
			someField: {
				options: [
					{ label: 'some.label1', value: 1 },
					{ label: 'some.label2', value: 2 }
				]
			}
		};
	}

}

module.exports = MyApiListFilters;
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
- `name`: The name of the filter param. This property is required.
- `internalName`: The name of the field, as defined in the model. This should not be defined in case it's equal to `name`
- `valueMapper`: A function to be called on the filter's value. This is optional.

### async formatRows(rows)
You can use this to format your records before they are returned.
For example, mapping DB friendly values to user friendly values, add default values, translation keys, etc.
