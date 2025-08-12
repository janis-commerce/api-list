/* eslint-disable no-template-curly-in-string */

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
	}),

	['iamStatement', {
		action: 's3:PutObject',
		resource: 'arn:aws:s3:::janis-batch-service-${self:custom.stage}/*'
	}]
];
