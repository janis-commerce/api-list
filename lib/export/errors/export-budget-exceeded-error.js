'use strict';

/**
 * @class ExportBudgetExceededError
 * @extends Error
 * @classdesc Sentinel error thrown inside the getPaged callback to stop the cursor iteration
 * when the export generation runs out of time budget. It is not a real failure: the part message
 * with `stopped: true` has already been sent and batch will orchestrate the resume.
 */
module.exports = class ExportBudgetExceededError extends Error {

	constructor(message = 'Export generation budget exceeded') {
		super(message);
		this.name = 'ExportBudgetExceededError';
	}
};
