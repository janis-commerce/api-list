# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- format filters method

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
