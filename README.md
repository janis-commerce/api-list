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

	get alwaysCallFormatter() {
		return true;
	}

	get fieldsToSelect() {
		return ['name', 'status'];
	}

	get fieldsToExclude() {
		return ['error'];
	}

	get fixedFields() {
		return ['code'];
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

## ApiListData

The following getters and methods can be used to customize and validate your List API.
All of them are optional.

### get modelName()
Returns model name. It is intent to be used to change the model's name and it will not get the model name from endpoint

### get alwaysCallFormatter()
This is used to force calling the `formatRows()` method even if `fields` or `excludeFields` are sent to the API.

### get fieldsToSelect()
This is used to determinate which fields should be selected from the DB.

**Important**: The `id` field is always returned.

If set as `false`. The _parameter_ `fields` will be ignored.

If a field is not found in the document it will be ignored.

### get fieldsToExclude()

_Since_ `5.8.0`

This is used to determinate witch fields must be excluded from the response.

If set as `false`. The _parameter_ `excludeFields` will be ignored.

**Important**: The `id` field is always returned.

If a field is not found in the document it will be ignored.

### get fixedFields()

_Since_ `5.8.0`

This is used to determinate witch fields **should always be returned**.

If a field is not found in the document it will be ignored.

### async formatRows(rows)
You can use this to format your records before they are returned.

For example, mapping DB friendly values to user friendly values, add default values, translation keys, etc.

### get sortableFields()
This is used to indicate which fields can be used to sort the list. Any other sort field will return a 400 status code.

<details>
	<summary>Example using sortableFields()</summary>

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

</details>

<details>
	<summary>**Using sortableFields objects with valueMapper**</summary>

Use sortable field valueMapper to return sorts for apply in database instead of sortable field name

```js
'use strict';

const { ApiListData } = require('@janiscommerce/api-list');

module.exports = class MyApiListData extends ApiListData {

	get sortableFields() {
		return [
			{
				name: 'foo',
				valueMapper: () => [['bar0', 'asc'], ['bar1']]
				/*
					The function in valueMapper must be return an array of array with strings.
					The first string is a sort name and the second is a sort direction.
					If not pass a sort direction in array, by default use a direction passed by data for 'foo' or the default sort direction.
					The default sort direction is 'asc'.
				*/
			},
			{
				name: 'bar',
				valueMapper: direction => (
					direction ? [['bar0', direction], ['bar1', direction]]: [['bar0', 'asc'], ['bar1']]
				)
				// You can use the direction passed from the data for 'bar' or the default sort direction to make a logic that comes in the function parameter
			}
		];
	}
};
```

</details>

### get availableFilters()

This is used to indicate which fields can be used to filter the list. Any other filter will return a 400 status code.
Filters can be customized by passing an object with the following properties:
- `name`: (string) The name of the filter param. This property is required.
- `internalName`: (string|function) The name of the field, as defined in the model. This should not be defined in case it's equal to `name`.
If it's a function (_since 3.1.0_), it must return a string and it will receive the following arguments: `(filterConfiguration, mappedValue, originalValue)`
- `valueMapper`: (function) A function to be called on the filter's value. This is optional.

### Value mappers

_Since 3.1.0_

This lib also exports some value mappers (to use as `valueMapper`) so you don't need to implement them yourself.

> :warning: Warning `startOfTheDayMapper` and `endOfTheDayMapper` are now deprecated. See [migration guide](docs/deprecations/001-start-and-end-of-day-filter-mapper.md).

<details>
	<summary>They are explained here with examples:</summary>

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
</details>

### get searchFilters()

_Since 3.3.0_

This is used to indicate which fields will be used to mapped multiple filters (OR Type) for the same value, using only `search` as single filter.
If it don't exist or return an empty array and try to use `search` filter will return 400 status code.
Can be combined with other filters.

<details>
	<summary>Example using searchFilters()</summary>

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

* `/api/entity?filters[search]=fo` with a uncompleted word.

Will filter the list for `someField: fo` or `otherField: fo` and will do a partial filter (like using `searchMapper`).

* `/api/entity?filters[search]=foo bar` with multiples words separated by white spaces.

Will filter the list for `someField: foo` or `someField: bar` or `otherField: foo` or `otherField: bar`.

</details>

### get staticFilters()
_Since 3.4.0_

This is used to set a filter with a fixed value for all requests.

<details>
	<summary>Example using staticFilters()</summary>

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

</details>

### async formatFilters(filters)
_Since 4.1.0_

This is used to programatically alter the filters. It will be executed after parsing static and dynamic filters.
If you return a falsy value it will not override them. Otherwise, the return value will be used as filters.

You can use this method, for example, to build complex filters or to ensure that a Date range filter is always being applied.

<details>
	<summary>Example using formatFilters()</summary>

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
</details>

### get customParameters()

This allows you to set custom **query parameters** for your API.

Can be customized by passing a string or object with the following properties:
- `name`: (string) The name of the custom param. This property is required.
- `valueMapper`: (function) A function to be called on the parameter's value. This is optional.

The `customParameters` and its values will be in `this.data` to use them in your API.

<details>
	<summary>Example using customParameters()</summary>

```js
'use strict';

const { ApiListData } = require('@janiscommerce/api-list');

module.exports = class MyApi extends ApiListData {

    get customParameters() {
        return [
			'someParam', // default string
			{
				name: 'numericParam',
				valueMapper: Number
			}
		];
	}

	async formatRows(rows) {

		// To access the parameter, the information arrives through `this.data`
		if(this.data.numericParam === 1)
			return rows.map(row => ({ ...row, oneMoreField: true })); // Do something with the additional parameter

		return rows;
	}
};
```

* This will allow the API to use custom query parameters. Example: https://domain.com/api/my-api-list?numericParam=1

</details>

### async formatSortables(sortables)
_Since 5.4.0_

This is used to programatically alter the sortables. It will be executed after parsing static and dynamic sortables.
If you return a falsy value it will not override them. Otherwise, the return value will be used as sortables.

You can use this method, for example, to build complex sorting.

<details>
	<summary>Example using formatSortables()</summary>

```js
'use strict';

const {
	ApiListData
} = require('@janiscommerce/api-list');

module.exports = class MyApiListData extends ApiListData {

	async formatSortables(sortables) {

		return Object.keys(sortables).reduce((currentSorts, key) => {

			// We can use 'customFilter' as an identifier for build a complex sorting
			if(key === 'customFilter') {
				const customSorts = { someField: 'asc', otherField: 'desc' };

				return { ...currentSorts, ...customSorts };
			}

			return { ...currentSorts, [key]: sorts[key] };

		}, {});
	}
};
```
</details>

### get maxPageSize()
_Since 5.5.0_

This _getter_ allow to configure a different maximum page-size than default: **100**.

<details>
	<summary>Example using maxPageSize()</summary>

```js
'use strict';

const {
	ApiListData
} = require('@janiscommerce/api-list');

module.exports = class MyApiListData extends ApiListData {

	get maxPageSize() {
		return 500;
	}
};
```
</details>

## Reducing responses

_Since_ `5.8.0`

An Api defined with **ApiListData** can be reduced using new parameters `fields` and `excludeFields`.

> :warning: **Warning** When a response is reduced, it will not call `formatRows()`, unless the API's `alwaysCallFormatter` getter returns `true`

This parameters will be passed to the **model** for reducing the response on the database-side.

For the following examples we will be using invented products with the information

```json
[{
	"id": 1,
	"code": "t-shirt-red",
	"name": "Shirt Red",
	"price": 200.5,
	"status": "active"
}, {
	"id": 2,
	"code": "t-shirt-blue",
	"name": "Shirt Blue",
	"price": 200.8,
	"status": "active"
}]
```

<details>
	<summary>Example: Reducing response with fields</summary>

When using `fields` we are telling the database the specific fields we wanna receive in the response.

**Important**. When using `fields`, `excludeFields` will be ignored.

```bash
curl --location -g --request GET 'https://my-catalog.com/api/product?fields[0]=code&fields[1]=name'

// expected output: [{ id: 1, code: 't-shirt-red', name: 'Shirt Red' }, { id: 2, code: 't-shirt-blue', name: 'Shirt Blue' }]

```

</details>

<details>
	<summary>Example: Reducing response with excludeFields</summary>

When using `excludeFields` we are telling the database the specific fields we **don't** wanna receive in the response.

**Important**. When using `fields`, `excludeFields` will be ignored.

```bash
curl --location -g --request GET 'https://my-catalog.com/api/product?excludeFields[0]=price'

// expected output: [{ id: 1, code: 't-shirt-red', name: 'Shirt Red', status: 'active' }, { id: 2, code: 't-shirt-blue', name: 'Shirt Blue', status: 'active' }]

```

</details>

## Request Headers

An ApiListData accepts request _headers_ to modify default behavior.

|Header|Description|Default|
|--|--|--|
|_x-janis-page_|Configure the page of the list to be consulted|**1**|
|_x-janis-page-size_|The amount of rows to be returned. (max **100**)|**60**||
|_x-janis-totals_|The package will calculate total using `getTotals()`. _Since 7.0.0_.|**false**||
|_x-janis-only-totals_|The package will calculate only total (no list items in response) using `getTotals()`. _Since 7.0.0_.|**false**||

> ℹ️ The maximum page size can be modified with `maxPageSize()` _getter_

## Response Headers

An ApiListData will response the following _headers_.

|Header|Description|
|--|--|
|_x-janis-page_|The page used to perform the `get()` command|
|_x-janis-page-size_|The page size used in the `get()` command|
|_x-janis-total_|The total of documents according the filters applied. Calculated with `getTotals()`|

> ℹ️ The total calculation can be obtained using request _header_ _x-janis-totals_ or _header_ _x-janis-only-totals_ as **true**. Using  _header_ _x-janis-only-totals_ will prevent using `get()` command| and no list items will be returned

## List APIs with parents

If you have for example, a list API for a sub-entity of one specific record, the parent will be automatically be added as a filter.

**Important:** The parent entity must be listed as an available filter

For example, the following endpoint: `/api/parent-entity/1/sub-entity`, will be a list of the sub-entity, and `parentEntity: '1'` will be set as a filter.

It could be thought as if it's equivalent to the following request: `/api/sub-entity?filters[parentEntity]=1`