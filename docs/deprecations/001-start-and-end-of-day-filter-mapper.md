# @janiscommerce/delivery-helpers/001

> Filter mappers 'startOfTheDayMapper' and 'endOfTheDayMapper' do not take user's timezone. Use a date range filter instead.

**Deprecated since:** `v5.1.1`

### Scope

When you use the `startOfTheDayMapper` or `endOfTheDayMapper` filter mapper in an API List.

These mappers were intended to map a date to the beginning or end of that day, in order to filter by a whole day instead of an specific microsecond. The problem wiht this is that it ignores the user's timezone which results in invalid results (some missing and some that shouldn't be returned) for non-UTC users.

The recommended way to resolve date filters is to offer a range filter and honor the exact dates that are sent by the user.

### :warning: Warning

The recommended migration path will result in a **non-compatible change** in your API.

### Migration

#### Before

```js
// my-api/list.js
const {
	ApiListData,
	FilterMappers: {
		startOfTheDayMapper,
		endOfTheDayMapper
	}
} = require('@janiscommerce/api-list');

class MyApiList extends ApiListData {

	get availableFilters() {
		return [
			{
				name: 'dayCreated',
				internalName: 'dateCreatedFrom',
				valueMapper: startOfTheDayMapper
			},
			{
				name: 'dayCreated',
				internalName: 'dateCreatedTo',
				valueMapper: endOfTheDayMapper
			}
		]
	}
}
```

```js
// models/my-api.js
const { Model } = require('@janiscommerce/model');

class MyApiList extends ApiListData {

	static get fields() {
		return {
			dateCreatedFrom: {
				field: 'dateCreated',
				type: 'greaterOrEqual'
			},
			dateCreatedTo: {
				field: 'dateCreated',
				type: 'lesserOrEqual'
			}
		};
	}
}
```

#### After

```js
// my-api/list.js
const {
	ApiListData
} = require('@janiscommerce/api-list');

class MyApiList extends ApiListData {

	get availableFilters() {
		return [
			{
				name: 'dateCreatedRange',
				internalName: 'dateCreatedFrom',
				valueMapper: ({ from }) => from && new Date(from)
			},
			{
				name: 'dateCreatedRange',
				internalName: 'dateCreatedTo',
				valueMapper: ({ to }) => to && new Date(to)
			}
		]
	}
}
```

```js
// models/my-api.js
// This file doesn't change
const { Model } = require('@janiscommerce/model');

class MyApiList extends ApiListData {

	static get fields() {
		return {
			dateCreatedFrom: {
				field: 'dateCreated',
				type: 'greaterOrEqual'
			},
			dateCreatedTo: {
				field: 'dateCreated',
				type: 'lesserOrEqual'
			}
		};
	}
}
```
