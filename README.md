# API List

[![Build Status](https://travis-ci.org/janis-commerce/api-list.svg?branch=master)](https://travis-ci.org/janis-commerce/api-list)
[![Coverage Status](https://coveralls.io/repos/github/janis-commerce/api-list/badge.svg?branch=master)](https://coveralls.io/github/janis-commerce/api-list?branch=master)

A package to handle JANIS List APIs

# Installation

```
npm install @janiscommerce/api-list
```

# Usage

- API List Data
```js
'use strict';

const { ApiListData } = require('@janiscommerce/api-list');

class MyApiListData extends ApiListData {

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

# List APIs with parents

If you have for example, a list API for a sub-entity of one specific record, the parent will be automatically be added as a filter.

**Important:** The parent entity must be listed as an available filter

For example, the following endpoint: `/api/parent-entity/1/sub-entity`, will be a list of the sub-entity, and `parentEntity: '1'` will be set as a filter.

It could be thought as if it's equivalent to the following request: `/api/sub-entity?filters[parentEntity]=1`
