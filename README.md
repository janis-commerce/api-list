# API List

![Build Status](https://github.com/janis-commerce/api-list/workflows/Build%20Status/badge.svg)
[![Coverage Status](https://coveralls.io/repos/github/janis-commerce/api-list/badge.svg?branch=master)](https://coveralls.io/github/janis-commerce/api-list?branch=master)
[![npm version](https://badge.fury.io/js/%40janiscommerce%2Fapi-list.svg)](https://www.npmjs.com/package/@janiscommerce/api-list)

A package to handle Janis List APIs

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

### get modelName()
Returns model name. It is intent to be used to change the model's name and it will not get the model name from endpoint

### get fieldsToSelect()
This is used to indicate which fields should be selected from the DB.
This allows you to select fields from other tables, and automatically join them in relational databases.
This fields **must** be defined in the model.

### get sortableFields()
This is used to indicate which fields can be used to sort the list. Any other sort field will return a 400 status code.

For example:
```js
'use strict';

const { ApiListData } = require('@janiscommerce/api-list');

module.exports = class MyApiListData extends ApiListData {

	get sortableFields() {
		return ['foo', 'bar'];
	}
};
```

* `/api/entity?sortBy=foo` with a single value.

Will sort the list by `foo` in direction `asc` that are the *default* 

* `/api/entity?sortBy=foo&sortDirection=desc` with a single value.

Will sort the list by `foo` in direction `desc`

* `/api/entity?sortBy[0]=foo&sortBy[1]=bar` with a single value.

Will sort the list by `foo` and `bar` in direction `asc` that are the *default* 

* `/api/entity?sortBy[0]=foo&sortBy[1]=bar&sortDirection=desc` with a single value.

Will sort the list by `foo` and `bar` in direction `desc`

* `/api/entity?sortBy[0]=foo&sortBy[1]=bar&sortDirection[0]=desc&sortDirection[1]=asc` with a single value.

Will sort the list by `foo` in direction `desc` and `bar` in direction `asc`. The **sortDirection** is indexed with **sortBy**

* `/api/entity?sortBy[0]=foo&sortBy[1]=bar&sortDirection[1]=desc` with a single value.

Will sort the list by `foo` in direction `asc` because is the *default value* and `bar` in direction `desc`

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

> :warning: `startOfTheDayMapper` and `endOfTheDayMapper` are now deprecated. See [migration guide](docs/deprecations/001-start-and-end-of-day-filter-mapper.md).

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

_Since 3.3.0_

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

* `/api/entity?filters[search]=foo bar` with multiples words separated by white spaces.

Will filter the list for `someField: foo` or `someField: bar` or `otherField: foo` or `otherField: bar`.

### get staticFilters()
_Since 3.4.0_

This is used to set a filter with a fixed value for all requests.

For example:

```js
'use strict';

const {
	ApiListData
} = require('@janiscommerce/api-list');

module.exports = class MyApiListData extends ApiListData {

	get staticFilters() {
		return {
			someExactDate: new Date('2020-02-27T14:23:44.963Z'),
			clients: this.session.clientCode
		};
	}
};
```

This will add two filters (`someExactDate` and `clients`) to the request filters (if any). The static filters will not be overriden by user-provided filters.

### async formatFilters(filters)
_Since 4.1.0_

This is used to programatically alter the filters. It will be executed after parsing static and dynamic filters.
If you return a falsy value it will not override them. Otherwise, the return value will be used as filters.

You can use this method, for example, to build complex filters or to ensure that a Date range filter is always being applied.

For example:

```js
'use strict';

const {
	ApiListData
} = require('@janiscommerce/api-list');

module.exports = class MyApiListData extends ApiListData {

	async formatFilters(filters) {

		if(filters.someDateFilterFrom && filters.someDateFilterFrom < new Date('2020-01-01T00:00:00.000Z')) {

			// This will override the someDateFilterFrom filter
			return {
				...filters,
				someDateFilterFrom: new Date('2020-02-27T14:23:44.963Z')
			};
		}

		// In this case it will not override the filters
	}
};
```

### get customParameters()

This allows you to set custom **query parameters** for your API.

Can be customized by passing an object with the following properties:
- `name`: (string) The name of the custom param. This property is required.
- `valueMapper`: (function) A function to be called on the filter's value. This is optional.

The `customParameters` and its values will be in `this.data` to use them in your API.

For example:

```js
'use strict';

const { ApiListData } = require('@janiscommerce/api-list');

module.exports = class MyApi extends ApiListData {

    get customParameters() {
        return [
			'someParam', // default string
			{
				name: 'otherParam',
				valueMapper: booleanMapper
			}
		];
	}

	async formatRows(rows) {

		// To access the parameter, the information arrives through `this.data`
		if(this.data.otherParam === true)
		
			// Do something with the additional parameter
			return rows.map(row => ({ ...row, oneMoreField: true }));

		return rows.map(row => (row));
	}
};

/* 
    This will allow the API to use custom query parameters, example:
    https://domain.com/api/my-api-list?otherParam=true
*/
```
