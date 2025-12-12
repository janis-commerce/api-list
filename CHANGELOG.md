# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [9.0.0] - 2025-12-12
### Added
- New property `noResults` to skip the `get()` call to the model and the totals calculation. This is useful when you know in advance that no results will be returned.
- `ExportConsumer` class to export data to S3 in chunks through Janis Batch Service.
- `x-janis-only-params` header to return only the parameters used to make the request.

## [8.1.1] - 2025-08-04
### Fixed
- Totals are now properly calculated when the found results are less than the limit in the first page.

## [8.1.0] - 2025-08-04
### Added
- Headers `x-janis-totals` and `x-janis-only-totals` now accept `max=X` format to set the limit for the total number of records.

### Fixed
- Totals are now properly calculated when the found results are less than the limit but not in the first page.

## [8.0.0] - 2024-02-22
### Added
- API now has a `alwaysCallFormatter` to enforce calling the `formatRows()` method, even when response is reduced with `fields` or `excludeFields`.

### Changed
- **BREAKING CHANGE** When the response is reduced with `fields` or `excludeFields`, the `formatRows()` method is not called any more.

## [7.1.1] - 2023-10-06
### Fixed
- Avoided a error when no records are returned

## [7.1.0] - 2023-10-04
### Added
- New header `x-janis-only-totals` to make request not return list items, only header `x-janis-total`

### Changed
- `x-janis-total` header default from true to false

## [7.0.0] - 2023-09-18
### Changed
- Update [@janiscommerce/api](https://www.npmjs.com/package/@janiscommerce/api) to version 8.0.0

## [6.0.0] - 2023-04-18
### Changed
- Update [@janiscommerce/api](https://www.npmjs.com/package/@janiscommerce/api) to version 7.0.0

## [5.8.0] - 2023-01-20
### Added
_ New _parameter_ `fields` to select specific fields to be responded.
_ New _parameter_ `excludeFields` to select specific fields to be excluded in the response.
- Now the _getter_ `fieldsToSelect` can be `false` to prevent to use `fields` _parameter_.
- New _getter_ `fieldsToExclude` to define witch fields must be excluded from the response.
- New _getter_ `fixedFields` to define witch fields must be responded and can't be excluded.

### Changed
- Now `fields` _parameter_ will send fields to the query, the model will reduce the response.

## [5.7.0] - 2022-12-27
### Added
- Getter `fields` to reduce the api response to just the defined fields.

## [5.6.1] - 2022-08-25
### Fixed
- Mapping request _header_ `x-janis-totals` as boolean to be received and used.

## [5.6.0] - 2022-08-25
### Added
- Request _header_ `x-janis-totals` to avoid `getTotals()` query and `x-janis-total` response _header_

### Changed
- Reorganized **README**

## [5.5.0] - 2022-08-25
### Added
- Getter `maxPageSize` to configure a bigger page-size on each **ApiList**

## [5.4.0] - 2022-08-04
### Added
- Now the `sortableFields` can be a object with a `valueMapper` to make a custom sort

## [5.3.2] - 2022-04-29
### Changed
- Changed internal implementation so data fetching can be overriden

## [5.3.1] - 2022-04-21
### Fixed
- Sending empty filters when filterMappers returned an empty value, now it doesn't return empty filters to avoid issues.

## [5.3.0] - 2022-03-28
### Added
- Optional getter `customParameters` in `apiListData` class for API custom query parameters.

## [5.2.1] - 2022-03-11
### Added
- Type-def comments were incorporated.

## [5.2.0] - 2022-02-26
### Changed
- From now on the `sortBy` and `sortDirection` can be a `string` or an `array`

## [5.1.1] - 2021-11-17
### Changed
- `startOfTheDayMapper` and `endOfTheDayMapper` filter mappers are now deprecated. [Migration guide](docs/deprecations/001-start-and-end-of-day-filter-mapper.md)

## [5.1.0] - 2021-04-28
### Changed
- Max page size limit increased when a service perform the request
- Updated dependencies

## [5.0.1] - 2020-12-23
### Fixed
- Now when it receives an array to filter and a value mapper function it process the function to each element of the array

## [5.0.0] - 2020-08-27
### Added
- GitHub Actions for build, coverage and publish

### Changed
- Updated `@janiscommerce/api` to `6.x.x`

## [4.1.1] - 2020-08-10
### Fixed
- Max page size is validated as 100 records

## [4.1.0] - 2020-07-29
### Added
- `formatFilters` method

## [4.0.1] - 2020-06-23
### Fixed
- Filters with an object as value are now valid

## [4.0.0] - 2020-06-16
### Changed
- API upgraded to v5 (`api-session` validates locations) (**BREAKING CHANGE**)

## [3.4.0] - 2020-06-10
### Added
- static filters
- modelName getter

### Fixed
- search filter combine with available filters

## [3.3.0] - 2020-06-05
### Added
- multiple search filters

## [3.2.1] - 2020-05-19
### Fixed
- filters validation unit test fixed

## [3.2.0] - 2020-05-19
### Removed
- `package-lock.json` file

## [3.1.0] - 2020-02-27
### Added
- Common value mappers exported as `FilterMappers`
- Filter `internalName` can now also be a function

## [3.0.2] - 2020-01-21
### Changed
- Dependencies updated

## [3.0.1] - 2019-10-01
### Changed
- API version updated to avoid dependency versions issues

### Fixed
- Tests typo fix

## [3.0.0] - 2019-10-01
### Removed
- ApiListFilters was removed (**BREAKING CHANGE**)

### Changed
- API upgraded to v4 (`api-session` injected) (**BREAKING CHANGE**)
- Model v3 compatibility (`api-session` injection) (**BREAKING CHANGE**)

## [2.0.1] - 2019-09-16
### Fixed
- Paging headers are now correctly parsed from string to number

## [2.0.0] - 2019-08-02
### Changed
- Now the response is an array in the body, and the total record count in the `x-janis-total` header (BREAKING CHANGE)

### Added
- Now you can define the `fieldsToSelect()` getter in your api to reduce or add fields that will be retrieved from the DB

## [1.1.0] - 2019-07-25
### Added
- Client model for client injected apis

## [1.0.1] - 2019-07-23
### Fixed
- Fix for AWS request path without basePath

## [1.0.0] - 2019-07-20
### Added
- Package inited
- Data and Filters APIs
- Tests
