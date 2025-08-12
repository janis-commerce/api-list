'use strict';

module.exports = SQSHelper => [

	SQSHelper.sqsPermissions,

	...SQSHelper.buildHooks({
		name: 'export',
		mainQueueProperties: { generateEnvVars: false, visibilityTimeout: 1000 },
		sourceSnsTopic: [{
			name: 'exportRequested',
			scope: 'remote',
			serviceCode: 'batch',
			// eslint-disable-next-line no-template-curly-in-string
			filterPolicy: { service: ['${self:custom.serviceCode}'] }
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
