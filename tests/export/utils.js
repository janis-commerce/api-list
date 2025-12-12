'use strict';

module.exports.createEvent = (eventSourceARN, clientCode, records) => {
	return {
		Records: records.map((body, index) => ({
			messageId: `e10d3743-34ff-4bc0-a3f7-${index.toString().padStart(12, '0')}`,
			receiptHandle: `e10d37${index.toString().padStart(10, '0')}`,
			eventSourceARN,
			messageAttributes: {
				'janis-client': { stringValue: clientCode }
			},
			body: JSON.stringify(body)
		}))
	};
};
