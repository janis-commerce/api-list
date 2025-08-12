'use strict';

const { SQSHelper } = require('sls-helper-plugin-janis'); // eslint-disable-line import/no-extraneous-dependencies

module.exports = () => [

	SQSHelper.sqsPermissions,

	...SQSHelper.buildHooks({
		name: 'export',
		mainQueueProperties: { generateEnvVars: false, visibilityTimeout: 1000 },
		sourceSnsTopic: [{
			name: 'exportRequested',
			scope: 'remote',
			serviceCode: 'batch',
			filterPolicy: { service: [process.env.JANIS_SERVICE_NAME] }
		}],
		consumerProperties: {
			prefixPath: 'export',
			timeout: 900,
			batchSize: 1,
			maximumBatchingWindow: 1,
			eventProperties: { maximumConcurrency: 2 }
		},
		dlqConsumerProperties: {
			timeout: 15,
			batchSize: 1,
			maximumBatchingWindow: 1,
			eventProperties: { maximumConcurrency: 2 }
		}
	})
];
