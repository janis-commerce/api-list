# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

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
