'use strict';

const { IterativeSQSConsumer } = require('@janiscommerce/sqs-consumer');

const { STSClient, AssumeRoleCommand } = require('@aws-sdk/client-sts');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');

// Record: { exportId, entity, parentEntity, params, userId, bucket, keyPrefix, queueUrl, messageData }

module.exports = class ExportDLQConsumer extends IterativeSQSConsumer {

	async processSingleRecord(record, logger) {

		if(!record.body?.exportId) {
			logger.error('Invalid record', record);
			return;
		}

		this.record = record.body;

		await this.prepareAwsClients();
		await this.sendMessageToErrorQueue();
	}

	async prepareAwsClients() {

		const sts = new STSClient();

		const { Credentials } = await sts.send(new AssumeRoleCommand({
			RoleArn: process.env.BATCH_EXPORT_ROLE_ARN,
			RoleSessionName: `export-consumer-${this.record.exportId}`
		}));

		if(!Credentials?.AccessKeyId || !Credentials?.SecretAccessKey || !Credentials?.SessionToken)
			throw new Error('Failed to assume role');

		const credentials = {
			accessKeyId: Credentials.AccessKeyId,
			secretAccessKey: Credentials.SecretAccessKey,
			sessionToken: Credentials.SessionToken
		};

		this.sqs = new SQSClient({ credentials });
	}

	async sendMessageToErrorQueue() {

		return this.sqs.send(new SendMessageCommand({
			QueueUrl: this.record.errorQueueUrl,
			MessageAttributes: {
				'janis-client': {
					DataType: 'String',
					StringValue: this.session.clientCode
				}
			},
			MessageBody: JSON.stringify({
				...this.record.messageData
			})
		}));
	}
};
