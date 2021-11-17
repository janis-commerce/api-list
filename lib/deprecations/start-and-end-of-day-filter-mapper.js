'use strict';

const { deprecate } = require('util');

const code = '@janiscommerce/api-list/001';

const migrationGuide = 'https://github.com/janis-commerce/api-list/blob/master/docs/deprecations/001-start-and-end-of-day-filter-mapper.md';

/* eslint-disable-next-line max-len */
const message = `Filter mappers 'startOfTheDayMapper' and 'endOfTheDayMapper' do not take user's timezone. Use a date range filter instead. See migration guide in ${migrationGuide}`;

module.exports = mapper => deprecate(mapper, message, code);
