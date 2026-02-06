/* eslint-disable no-template-curly-in-string */

'use strict';

module.exports = (SQSHelper, { mainQueueProperties = {}, consumerProperties = {} } = {}) => [

	SQSHelper.sqsPermissions,

	...SQSHelper.buildHooks({
		name: 'export',
		mainQueueProperties: {
			generateEnvVars: false,
			visibilityTimeout: 1000,
			maxReceiveCount: 2,
			...mainQueueProperties
		},
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
			...consumerProperties,
			eventProperties: {
				maximumConcurrency: 5,
				...consumerProperties?.eventProperties || {}
			},
			functionProperties: {
				memorySize: 2048,
				...consumerProperties?.functionProperties || {}
			},
			rawProperties: {
				environment: {
					...consumerProperties?.rawProperties?.environment || {},
					BATCH_EXPORT_ROLE_ARN: '${env:BATCH_EXPORT_ROLE_ARN}'
				}
			}
		},
		dlqConsumerProperties: {
			prefixPath: 'export',
			timeout: 15,
			batchSize: 1,
			maximumBatchingWindow: 1,
			eventProperties: { maximumConcurrency: 2 },
			rawProperties: {
				environment: {
					BATCH_EXPORT_ROLE_ARN: '${env:BATCH_EXPORT_ROLE_ARN}'
				}
			}
		}
	}),

	['iamStatement', {
		action: 'Sts:AssumeRole',
		resource: '${env:BATCH_EXPORT_ROLE_ARN}'
	}]
];
