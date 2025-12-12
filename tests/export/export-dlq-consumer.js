'use strict';

require('lllog')('none');

const sinon = require('sinon');
const assert = require('assert');

const { mockClient } = require('aws-sdk-client-mock');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { STSClient, AssumeRoleCommand } = require('@aws-sdk/client-sts');

const { SQSHandler, IterativeSQSConsumer } = require('@janiscommerce/sqs-consumer');

const ExportDLQConsumer = require('../../lib/export/export-dlq-consumer');

const { createEvent } = require('./utils');

describe('Export DLQ Consumer', () => {

	const clientCode = 'defaultClient';

	const exportId = '693ae8670f91fdbb20683f87';
	const entity = 'product';

	const sqsQueueArn = 'arn:aws:sqs:us-east-1:000000000000:ExportQueue';
	const originalEnv = { ...process.env };

	const errorQueueUrl = 'https://sqs.us-east-1.amazonaws.com/000000000000/SetExportErrorQueue';

	let stsMock;
	let sqsMock;

	const validEvent = createEvent(sqsQueueArn, clientCode, [{
		exportId,
		entity,
		errorQueueUrl,
		messageData: {
			exportId,
			entity,
			errorMessage: 'Original error'
		}
	}]);

	const assertSendMessage = calls => {

		const expectedLength = calls.length;
		const actualLength = sqsMock.calls().length;

		assert.deepStrictEqual(
			actualLength,
			expectedLength,
			`Number of send message calls does not match (expected: ${expectedLength}, actual: ${actualLength})`
		);

		calls.forEach((call, index) => {
			assert.deepStrictEqual(sqsMock.call(index).firstArg.input, {
				...call,
				MessageAttributes: {
					'janis-client': {
						DataType: 'String',
						StringValue: clientCode
					}
				}
			});
		});
	};

	beforeEach(() => {

		process.env.BATCH_EXPORT_ROLE_ARN = sqsQueueArn;
		stsMock = mockClient(STSClient);
		sqsMock = mockClient(SQSClient);

		stsMock.on(AssumeRoleCommand).resolves({
			Credentials: {
				AccessKeyId: 'accessKeyId',
				SecretAccessKey: 'secretAccessKey',
				SessionToken: 'sessionToken'
			}
		});

		sqsMock.on(SendMessageCommand).resolves({
			MessageId: '2854b300-709f-41b7-84f2-1e916425a0ef'
		});

		sinon.stub(IterativeSQSConsumer.prototype, 'addFailedMessage');
	});

	afterEach(() => {
		sinon.restore();
		process.env = { ...originalEnv };
		stsMock.restore();
		sqsMock.restore();
	});

	it('Should process valid record, assume role and send message to error queue', async () => {

		await SQSHandler.handle(ExportDLQConsumer, validEvent);

		assertSendMessage([{
			QueueUrl: errorQueueUrl,
			MessageBody: JSON.stringify({
				exportId,
				entity,
				errorMessage: 'Original error'
			})
		}]);
	});

	it('Should not send message when AssumeRoleCommand fails', async () => {

		stsMock.on(AssumeRoleCommand).rejects(new Error('Assume role error'));

		await assert.rejects(SQSHandler.handle(ExportDLQConsumer, validEvent), {
			message: 'Assume role error'
		});

		assertSendMessage([]);
	});

	it('Should not send message when AssumeRole returns null credentials', async () => {

		stsMock.on(AssumeRoleCommand).resolves({ Credentials: null });

		try {
			await SQSHandler.handle(ExportDLQConsumer, validEvent);
		} catch(error) {
			assert.strictEqual(error.message, 'Failed to assume role');
		}

		assertSendMessage([]);
	});

	it('Should not send message when AssumeRole returns credentials without AccessKeyId', async () => {

		stsMock.on(AssumeRoleCommand).resolves({
			Credentials: {
				SecretAccessKey: 'secretAccessKey',
				SessionToken: 'sessionToken'
			}
		});

		await assert.rejects(SQSHandler.handle(ExportDLQConsumer, validEvent), {
			message: 'Failed to assume role'
		});

		assertSendMessage([]);
	});

	it('Should not send message when AssumeRole returns credentials without SecretAccessKey', async () => {

		stsMock.on(AssumeRoleCommand).resolves({
			Credentials: {
				AccessKeyId: 'accessKeyId',
				SessionToken: 'sessionToken'
			}
		});

		await assert.rejects(SQSHandler.handle(ExportDLQConsumer, validEvent), {
			message: 'Failed to assume role'
		});

		assertSendMessage([]);
	});

	it('Should not send message when AssumeRole returns credentials without SessionToken', async () => {

		stsMock.on(AssumeRoleCommand).resolves({
			Credentials: {
				AccessKeyId: 'accessKeyId',
				SecretAccessKey: 'secretAccessKey'
			}
		});

		await assert.rejects(SQSHandler.handle(ExportDLQConsumer, validEvent), {
			message: 'Failed to assume role'
		});

		assertSendMessage([]);
	});

	it('Should not process when invalid record received (missing exportId)', async () => {

		const invalidEvent = createEvent(sqsQueueArn, clientCode, [{
			entity,
			errorQueueUrl,
			messageData: {
				exportId,
				entity
			}
		}]);

		await SQSHandler.handle(ExportDLQConsumer, invalidEvent);

		assertSendMessage([]);
		sinon.assert.notCalled(IterativeSQSConsumer.prototype.addFailedMessage);
	});

	it('Should not process when invalid record received (missing body)', async () => {

		const invalidEvent = createEvent(sqsQueueArn, clientCode, [{}]);

		await SQSHandler.handle(ExportDLQConsumer, invalidEvent);

		const expectedLength = 0;
		const actualLength = stsMock.calls().length;

		assert.deepStrictEqual(
			actualLength,
			expectedLength,
			`Number of AssumeRoleCommand calls does not match (expected: ${expectedLength}, actual: ${actualLength})`
		);

		assertSendMessage([]);
		sinon.assert.notCalled(IterativeSQSConsumer.prototype.addFailedMessage);
	});
});
