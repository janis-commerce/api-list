/* eslint-disable max-len */
/* eslint-disable max-classes-per-file */

'use strict';

require('lllog')('none');

const sinon = require('sinon');
const assert = require('assert');
const path = require('path');
const { EJSON } = require('bson');
const crypto = require('crypto');

const { mockClient } = require('aws-sdk-client-mock');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { STSClient, AssumeRoleCommand } = require('@aws-sdk/client-sts');

const mockRequire = require('mock-require');

const Model = require('@janiscommerce/model');

const { SQSHandler, IterativeSQSConsumer } = require('@janiscommerce/sqs-consumer');

const { ApiListData } = require('../../lib');

const Uploader = require('../../lib/helpers/uploader');

const ExportConsumer = require('../../lib/export/export-consumer');
const ExportBudgetExceededError = require('../../lib/export/errors/export-budget-exceeded-error');

const { createEvent } = require('./utils');

describe('Export SQS Consumer', () => {

	const clientCode = 'defaultClient';

	const exportId = '693ae8670f91fdbb20683f87';
	const entity = 'product';

	const modelPath = path.join(process.cwd(), '', 'models', entity);
	const apiListPath = path.join(process.cwd(), '', 'api', entity, 'list.js');

	const sqsQueueArn = 'arn:aws:sqs:us-east-1:000000000000:ExportQueue';
	const originalEnv = { ...process.env };

	let stsMock;
	let sqsMock;
	let clock;

	const uuid1 = 'be8a87b3-d766-49d0-bd02-1c174fa9bf3a';
	const uuid2 = '06d331b9-b90a-404a-996e-ea8b1eb64bf0';

	const currentDate = new Date();

	const queueUrl = 'https://sqs.us-east-1.amazonaws.com/000000000000/ProcessMainFileQueue';
	const dependencyQueueUrl = 'https://sqs.us-east-1.amazonaws.com/000000000000/ProcessDependencyFileQueue';
	const errorQueueUrl = 'https://sqs.us-east-1.amazonaws.com/000000000000/SetExportErrorQueue';

	class ProductModel extends Model {}

	const validEvent = createEvent(sqsQueueArn, clientCode, [{
		exportId,
		entity,
		params: EJSON.stringify({}),
		keyPrefix: `export-dependencies/${clientCode}/${exportId}/${entity}/`,
		shouldFormatRows: true, // main file
		queueUrl,
		errorQueueUrl,
		messageData: {
			exportId,
			entity
		}
	}]);

	const assertUploaderAdd = calls => {

		sinon.assert.callCount(Uploader.prototype.add, calls.length);

		calls.forEach(call => {
			sinon.assert.calledWithExactly(Uploader.prototype.add, call);
		});
	};

	const assertSendMessage = calls => {

		assert.deepStrictEqual(sqsMock.calls().length, calls.length, `Number of send message calls does not match (expected: ${calls.length}, actual: ${sqsMock.calls().length})`);

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

		clock = sinon.useFakeTimers(currentDate);

		mockRequire(modelPath, ProductModel);

		sinon.stub(crypto, 'randomUUID')
			.onFirstCall()
			.returns(uuid1)
			.onSecondCall()
			.returns(uuid2);

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

		sinon.stub(Uploader.prototype, 'add').resolves();
		sinon.stub(Uploader.prototype, 'upload').resolves();

		sinon.stub(IterativeSQSConsumer.prototype, 'addFailedMessage');
	});

	afterEach(() => {
		sinon.restore();
		process.env = { ...originalEnv };
		stsMock.restore();
		sqsMock.restore();
		mockRequire.stopAll();
	});

	it('Should use model to get documents and api list to format rows then upload to s3 (1 page / 1 file)', async () => {

		class ProductApiList extends ApiListData {

			formatRows(rows) {
				return rows.map(row => ({
					...row,
					name: row.name.toUpperCase()
				}));
			}
		}

		mockRequire(apiListPath, ProductApiList);

		sinon.stub(ProductModel.prototype, 'getPaged')
			.callsFake((params, callback) => callback.call(null, [
				{ id: '693beee89a9dde1d3edcf2c9', name: 'Product 1' },
				{ id: '693beee89a9dde1d3edcf2ca', name: 'Product 2' }
			]));

		await SQSHandler.handle(ExportConsumer, validEvent);

		assertUploaderAdd([
			{ id: '693beee89a9dde1d3edcf2c9', name: 'PRODUCT 1' },
			{ id: '693beee89a9dde1d3edcf2ca', name: 'PRODUCT 2' }
		]);

		sinon.assert.calledOnceWithExactly(Uploader.prototype.upload);

		sinon.assert.calledOnceWithExactly(ProductModel.prototype.getPaged, { page: 1, limit: 10000 }, sinon.match.func);

		assertSendMessage([{
			QueueUrl: queueUrl,
			MessageBody: JSON.stringify({
				exportId,
				entity,
				part: 1,
				isLastPart: true,
				filename: `export-dependencies/${clientCode}/${exportId}/${entity}/${uuid1}.ndjson.gz`,
				pageSize: 10000,
				rowsPerFile: 250000,
				rowsCount: 2,
				lastId: '693beee89a9dde1d3edcf2ca',
				dateStart: currentDate.toISOString(),
				dateEnd: currentDate.toISOString()
			})
		}]);
	});

	it('Should use raw _id as lastId even when formatRows strips or transforms the id field', async () => {

		class ProductApiList extends ApiListData {

			formatRows(rows) {
				// strips id entirely, returning only a derived field
				return rows.map(({ name }) => ({ formattedName: name.toUpperCase() }));
			}
		}

		mockRequire(apiListPath, ProductApiList);

		sinon.stub(ProductModel.prototype, 'getPaged')
			.callsFake((params, callback) => callback.call(null, [
				{ id: '693beee89a9dde1d3edcf2c9', name: 'Product 1' },
				{ id: '693beee89a9dde1d3edcf2ca', name: 'Product 2' }
			]));

		await SQSHandler.handle(ExportConsumer, validEvent);

		// uploader receives the formatted (id-less) shape
		assertUploaderAdd([
			{ formattedName: 'PRODUCT 1' },
			{ formattedName: 'PRODUCT 2' }
		]);

		sinon.assert.calledOnceWithExactly(Uploader.prototype.upload);

		// lastId must be the raw _id of the last original row, not undefined/null
		assertSendMessage([{
			QueueUrl: queueUrl,
			MessageBody: JSON.stringify({
				exportId,
				entity,
				part: 1,
				isLastPart: true,
				filename: `export-dependencies/${clientCode}/${exportId}/${entity}/${uuid1}.ndjson.gz`,
				pageSize: 10000,
				rowsPerFile: 250000,
				rowsCount: 2,
				lastId: '693beee89a9dde1d3edcf2ca',
				dateStart: currentDate.toISOString(),
				dateEnd: currentDate.toISOString()
			})
		}]);
	});

	it('Should use model to get documents and api list to format rows then upload to s3 (2 pages / 1 file)', async () => {

		class ProductApiList extends ApiListData {}

		mockRequire(apiListPath, ProductApiList);

		sinon.stub(ProductModel.prototype, 'getPaged')
			.callsFake(async (params, callback) => {
				await callback.call(null, [
					{ id: '693beee89a9dde1d3edcf2c9', name: 'Product 1' }
				]);
				await callback.call(null, [
					{ id: '693beee89a9dde1d3edcf2ca', name: 'Product 2' }
				]);
			});

		class CustomExportConsumer extends ExportConsumer {
			get pageSize() {
				return 1;
			}
		}

		await SQSHandler.handle(CustomExportConsumer, validEvent);

		assertUploaderAdd([
			{ id: '693beee89a9dde1d3edcf2c9', name: 'Product 1' },
			{ id: '693beee89a9dde1d3edcf2ca', name: 'Product 2' }
		]);

		sinon.assert.calledOnceWithExactly(Uploader.prototype.upload);

		sinon.assert.calledOnceWithExactly(ProductModel.prototype.getPaged, { page: 1, limit: 1 }, sinon.match.func);

		assertSendMessage([{
			QueueUrl: queueUrl,
			MessageBody: JSON.stringify({
				exportId,
				entity,
				part: 1,
				isLastPart: true,
				filename: `export-dependencies/${clientCode}/${exportId}/${entity}/${uuid1}.ndjson.gz`,
				pageSize: 1,
				rowsPerFile: 250000,
				rowsCount: 2,
				lastId: '693beee89a9dde1d3edcf2ca',
				dateStart: currentDate.toISOString(),
				dateEnd: currentDate.toISOString()
			})
		}]);
	});

	it('Should use model to get documents and api list to format rows then upload to s3 (2 pages / 2 files)', async () => {

		class ProductApiList extends ApiListData {}

		mockRequire(apiListPath, ProductApiList);

		sinon.stub(ProductModel.prototype, 'getPaged')
			.callsFake(async (params, callback) => {
				await callback.call(null, [
					{ id: '693beee89a9dde1d3edcf2c9', name: 'Product 1' }
				]);
				await callback.call(null, [
					{ id: '693beee89a9dde1d3edcf2ca', name: 'Product 2' }
				]);
			});

		class CustomExportConsumer extends ExportConsumer {
			get rowsPerFile() {
				return 1;
			}

			get pageSize() {
				return 1;
			}
		}

		await SQSHandler.handle(CustomExportConsumer, validEvent);

		assertUploaderAdd([
			{ id: '693beee89a9dde1d3edcf2c9', name: 'Product 1' },
			{ id: '693beee89a9dde1d3edcf2ca', name: 'Product 2' }
		]);

		sinon.assert.calledTwice(Uploader.prototype.upload);
		sinon.assert.calledWithExactly(Uploader.prototype.upload);

		sinon.assert.calledOnceWithExactly(ProductModel.prototype.getPaged, { page: 1, limit: 1 }, sinon.match.func);

		assertSendMessage([{
			QueueUrl: queueUrl,
			MessageBody: JSON.stringify({
				exportId,
				entity,
				part: 1,
				isLastPart: false,
				filename: `export-dependencies/${clientCode}/${exportId}/${entity}/${uuid1}.ndjson.gz`,
				pageSize: 1,
				rowsPerFile: 1,
				rowsCount: 1,
				lastId: '693beee89a9dde1d3edcf2c9',
				dateStart: currentDate.toISOString(),
				dateEnd: currentDate.toISOString()
			})
		}, {
			QueueUrl: queueUrl,
			MessageBody: JSON.stringify({
				exportId,
				entity,
				part: 2,
				isLastPart: true,
				filename: `export-dependencies/${clientCode}/${exportId}/${entity}/${uuid2}.ndjson.gz`,
				pageSize: 1,
				rowsPerFile: 1,
				rowsCount: 1,
				lastId: '693beee89a9dde1d3edcf2ca',
				dateStart: currentDate.toISOString(),
				dateEnd: currentDate.toISOString()
			})
		}]);
	});

	it('Should send message when no documents found', async () => {

		class ProductApiList extends ApiListData {}

		mockRequire(apiListPath, ProductApiList);

		sinon.stub(ProductModel.prototype, 'getPaged');

		await SQSHandler.handle(ExportConsumer, validEvent);

		assertUploaderAdd([]);

		sinon.assert.notCalled(Uploader.prototype.upload);

		sinon.assert.calledOnceWithExactly(ProductModel.prototype.getPaged, { page: 1, limit: 10000 }, sinon.match.func);

		assertSendMessage([{
			QueueUrl: queueUrl,
			MessageBody: JSON.stringify({
				exportId,
				entity,
				part: 1,
				isLastPart: true,
				pageSize: 10000,
				rowsPerFile: 250000,
				rowsCount: 0,
				lastId: null,
				dateStart: currentDate.toISOString(),
				dateEnd: currentDate.toISOString()
			})
		}]);
	});

	it('Should not format rows for dependencies', async () => {

		class ProductDependencyApiList extends ApiListData {

			formatRows(rows) {
				return rows.map(row => ({
					...row,
					name: row.name.toUpperCase()
				}));
			}
		}

		sinon.spy(ProductDependencyApiList.prototype, 'formatRows');

		mockRequire(apiListPath, ProductDependencyApiList);

		sinon.stub(ProductModel.prototype, 'getPaged')
			.callsFake((params, callback) => callback.call(null, [
				{ id: '693beee89a9dde1d3edcf2c9', name: 'Product 1' },
				{ id: '693beee89a9dde1d3edcf2ca', name: 'Product 2' }
			]));

		const event = createEvent(sqsQueueArn, clientCode, [{
			exportId,
			entity,
			params: EJSON.stringify([{
				fields: ['referenceId', 'name'],
				filters: {
					id: ['693beee89a9dde1d3edcf2c9', '693beee89a9dde1d3edcf2ca']
				}
			}]),
			keyPrefix: `export-dependencies/${clientCode}/${exportId}/${entity}`,
			shouldFormatRows: false, // dependencies do not format rows
			queueUrl: dependencyQueueUrl,
			errorQueueUrl,
			messageData: {
				exportId,
				entity,
				dependencyName: 'products'
			}
		}]);

		await SQSHandler.handle(ExportConsumer, event);

		sinon.assert.notCalled(ProductDependencyApiList.prototype.formatRows);

		assertUploaderAdd([
			{ id: '693beee89a9dde1d3edcf2c9', name: 'Product 1' },
			{ id: '693beee89a9dde1d3edcf2ca', name: 'Product 2' }
		]);

		sinon.assert.calledOnceWithExactly(Uploader.prototype.upload);

		sinon.assert.calledOnceWithExactly(ProductModel.prototype.getPaged, {
			fields: ['referenceId', 'name'],
			filters: { id: ['693beee89a9dde1d3edcf2c9', '693beee89a9dde1d3edcf2ca'] },
			page: 1,
			limit: 10000
		}, sinon.match.func);

		assertSendMessage([{
			QueueUrl: dependencyQueueUrl,
			MessageBody: JSON.stringify({
				exportId,
				entity,
				dependencyName: 'products',
				part: 1,
				isLastPart: true,
				filename: `export-dependencies/${clientCode}/${exportId}/${entity}/${uuid1}.ndjson.gz`,
				pageSize: 10000,
				rowsPerFile: 250000,
				rowsCount: 2,
				lastId: '693beee89a9dde1d3edcf2ca',
				dateStart: currentDate.toISOString(),
				dateEnd: currentDate.toISOString()
			})
		}]);
	});

	describe('Validations for pageSize and rowsPerFile', () => {

		it('Should use custom pageSize and rowsPerFile for entity when provided (limits exceeded)', async () => {

			class ProductApiList extends ApiListData {}

			mockRequire(apiListPath, ProductApiList);

			sinon.stub(ProductModel.prototype, 'getPaged')
				.callsFake(async (params, callback) => {
					await callback.call(null, [
						{ id: '693beee89a9dde1d3edcf2c9', name: 'Product 1' },
						{ id: '693beee89a9dde1d3edcf2ca', name: 'Product 2' }
					]);
				});

			class CustomExportConsumer extends ExportConsumer {
				get pageSizeByEntity() {
					return {
						product: 50000 // will use max page size as pageSize
					};
				}

				get rowsPerFileByEntity() {
					return {
						product: 500000 // will use max rows per file as rowsPerFile
					};
				}
			}

			await SQSHandler.handle(CustomExportConsumer, validEvent);

			assertUploaderAdd([
				{ id: '693beee89a9dde1d3edcf2c9', name: 'Product 1' },
				{ id: '693beee89a9dde1d3edcf2ca', name: 'Product 2' }
			]);

			sinon.assert.calledOnceWithExactly(Uploader.prototype.upload);

			sinon.assert.calledOnceWithExactly(ProductModel.prototype.getPaged, { page: 1, limit: 25000 }, sinon.match.func);

			assertSendMessage([{
				QueueUrl: queueUrl,
				MessageBody: JSON.stringify({
					exportId,
					entity,
					part: 1,
					isLastPart: true,
					filename: `export-dependencies/${clientCode}/${exportId}/${entity}/${uuid1}.ndjson.gz`,
					pageSize: 25000,
					rowsPerFile: 250000,
					rowsCount: 2,
					lastId: '693beee89a9dde1d3edcf2ca',
					dateStart: currentDate.toISOString(),
					dateEnd: currentDate.toISOString()
				})
			}]);
		});

		it('Should use rowsPerFile from pageSize when rowsPerFile is lower than pageSize', async () => {

			class ProductApiList extends ApiListData {}

			mockRequire(apiListPath, ProductApiList);

			sinon.stub(ProductModel.prototype, 'getPaged')
				.callsFake(async (params, callback) => {
					await callback.call(null, [
						{ id: '693beee89a9dde1d3edcf2c9', name: 'Product 1' },
						{ id: '693beee89a9dde1d3edcf2ca', name: 'Product 2' }
					]);
				});

			class CustomExportConsumer extends ExportConsumer {
				get pageSize() {
					return 5000;
				}

				get rowsPerFile() {
					return 1000; // will use pageSize as rowsPerFile
				}
			}

			await SQSHandler.handle(CustomExportConsumer, validEvent);

			assertUploaderAdd([
				{ id: '693beee89a9dde1d3edcf2c9', name: 'Product 1' },
				{ id: '693beee89a9dde1d3edcf2ca', name: 'Product 2' }
			]);

			sinon.assert.calledOnceWithExactly(Uploader.prototype.upload);

			sinon.assert.calledOnceWithExactly(ProductModel.prototype.getPaged, { page: 1, limit: 5000 }, sinon.match.func);

			assertSendMessage([{
				QueueUrl: queueUrl,
				MessageBody: JSON.stringify({
					exportId,
					entity,
					part: 1,
					isLastPart: true,
					filename: `export-dependencies/${clientCode}/${exportId}/${entity}/${uuid1}.ndjson.gz`,
					pageSize: 5000,
					rowsPerFile: 5000,
					rowsCount: 2,
					lastId: '693beee89a9dde1d3edcf2ca',
					dateStart: currentDate.toISOString(),
					dateEnd: currentDate.toISOString()
				})
			}]);
		});
	});

	describe('Budget exceeded (large exports)', () => {

		class SingleRowPerFileConsumer extends ExportConsumer {
			get pageSize() {
				return 1;
			}

			get rowsPerFile() {
				return 1;
			}
		}

		it('Should send the part with stopped:true and stop the cursor (sentinel) when the budget is exceeded', async () => {

			class ProductApiList extends ApiListData {}

			mockRequire(apiListPath, ProductApiList);

			sinon.stub(ProductModel.prototype, 'getPaged')
				.callsFake(async (params, callback) => {

					await callback.call(null, [
						{ id: '693beee89a9dde1d3edcf2c9', name: 'Product 1' }
					]);

					// simulate a slow part: elapsed + lastPartDuration * factor > 720s budget
					clock.tick(600 * 1000);

					// this page closes part 1 -> budget check fires -> stopped + sentinel
					await callback.call(null, [
						{ id: '693beee89a9dde1d3edcf2ca', name: 'Product 2' }
					]);

					// never reached: the cursor was stopped by the sentinel
					await callback.call(null, [
						{ id: '693beee89a9dde1d3edcf2cb', name: 'Product 3' }
					]);
				});

			await SQSHandler.handle(SingleRowPerFileConsumer, validEvent);

			// only Product 1 was uploaded; the in-flight page (Product 2) was discarded with the cut
			assertUploaderAdd([
				{ id: '693beee89a9dde1d3edcf2c9', name: 'Product 1' }
			]);

			sinon.assert.calledOnceWithExactly(Uploader.prototype.upload);

			// single part message with stopped:true, no error queue, message ACKed
			assertSendMessage([{
				QueueUrl: queueUrl,
				MessageBody: JSON.stringify({
					exportId,
					entity,
					part: 1,
					isLastPart: false,
					stopped: true,
					filename: `export-dependencies/${clientCode}/${exportId}/${entity}/${uuid1}.ndjson.gz`,
					pageSize: 1,
					rowsPerFile: 1,
					rowsCount: 1,
					lastId: '693beee89a9dde1d3edcf2c9',
					dateStart: currentDate.toISOString(),
					dateEnd: new Date().toISOString()
				})
			}]);

			sinon.assert.notCalled(IterativeSQSConsumer.prototype.addFailedMessage);
		});

		it('Should terminate OK when the sentinel is wrapped by the model in a MongoDBError (previousError)', async () => {

			class ProductApiList extends ApiListData {}

			mockRequire(apiListPath, ProductApiList);

			sinon.stub(ProductModel.prototype, 'getPaged')
				.callsFake(async (params, callback) => {

					try {

						await callback.call(null, [
							{ id: '693beee89a9dde1d3edcf2c9', name: 'Product 1' }
						]);

						clock.tick(600 * 1000);

						await callback.call(null, [
							{ id: '693beee89a9dde1d3edcf2ca', name: 'Product 2' }
						]);

					} catch(error) {

						if(error instanceof ExportBudgetExceededError) {
							// emulate @janiscommerce/mongodb wrapping the callback throw
							const wrapped = new Error('MongoDB error');
							wrapped.name = 'MongoDBError';
							wrapped.previousError = error;
							throw wrapped;
						}

						throw error;
					}
				});

			await SQSHandler.handle(SingleRowPerFileConsumer, validEvent);

			assertSendMessage([{
				QueueUrl: queueUrl,
				MessageBody: JSON.stringify({
					exportId,
					entity,
					part: 1,
					isLastPart: false,
					stopped: true,
					filename: `export-dependencies/${clientCode}/${exportId}/${entity}/${uuid1}.ndjson.gz`,
					pageSize: 1,
					rowsPerFile: 1,
					rowsCount: 1,
					lastId: '693beee89a9dde1d3edcf2c9',
					dateStart: currentDate.toISOString(),
					dateEnd: new Date().toISOString()
				})
			}]);

			sinon.assert.notCalled(IterativeSQSConsumer.prototype.addFailedMessage);
		});

		it('Should not cut when the budget is not exceeded (closes parts and finishes normally)', async () => {

			class ProductApiList extends ApiListData {}

			mockRequire(apiListPath, ProductApiList);

			sinon.stub(ProductModel.prototype, 'getPaged')
				.callsFake(async (params, callback) => {
					await callback.call(null, [
						{ id: '693beee89a9dde1d3edcf2c9', name: 'Product 1' }
					]);
					await callback.call(null, [
						{ id: '693beee89a9dde1d3edcf2ca', name: 'Product 2' }
					]);
				});

			await SQSHandler.handle(SingleRowPerFileConsumer, validEvent);

			// 2 parts, both closed normally, last one isLastPart
			assertSendMessage([{
				QueueUrl: queueUrl,
				MessageBody: JSON.stringify({
					exportId,
					entity,
					part: 1,
					isLastPart: false,
					filename: `export-dependencies/${clientCode}/${exportId}/${entity}/${uuid1}.ndjson.gz`,
					pageSize: 1,
					rowsPerFile: 1,
					rowsCount: 1,
					lastId: '693beee89a9dde1d3edcf2c9',
					dateStart: currentDate.toISOString(),
					dateEnd: currentDate.toISOString()
				})
			}, {
				QueueUrl: queueUrl,
				MessageBody: JSON.stringify({
					exportId,
					entity,
					part: 2,
					isLastPart: true,
					filename: `export-dependencies/${clientCode}/${exportId}/${entity}/${uuid2}.ndjson.gz`,
					pageSize: 1,
					rowsPerFile: 1,
					rowsCount: 1,
					lastId: '693beee89a9dde1d3edcf2ca',
					dateStart: currentDate.toISOString(),
					dateEnd: currentDate.toISOString()
				})
			}]);

			sinon.assert.notCalled(IterativeSQSConsumer.prototype.addFailedMessage);
		});

		it('Should cut earlier when EXPORT_GENERATION_BUDGET_MS lowers the budget (hot-tunable for testing)', async () => {

			// 5s budget: a part that took 5s tripped it (5000 + 5000*1.25 > 5000), while the default 720s would not
			process.env.EXPORT_GENERATION_BUDGET_MS = '5000';

			class ProductApiList extends ApiListData {}

			mockRequire(apiListPath, ProductApiList);

			sinon.stub(ProductModel.prototype, 'getPaged')
				.callsFake(async (params, callback) => {

					await callback.call(null, [
						{ id: '693beee89a9dde1d3edcf2c9', name: 'Product 1' }
					]);

					clock.tick(5 * 1000);

					// closes part 1 -> budget check fires with the lowered budget -> stopped + sentinel
					await callback.call(null, [
						{ id: '693beee89a9dde1d3edcf2ca', name: 'Product 2' }
					]);

					// never reached
					await callback.call(null, [
						{ id: '693beee89a9dde1d3edcf2cb', name: 'Product 3' }
					]);
				});

			await SQSHandler.handle(SingleRowPerFileConsumer, validEvent);

			assertSendMessage([{
				QueueUrl: queueUrl,
				MessageBody: JSON.stringify({
					exportId,
					entity,
					part: 1,
					isLastPart: false,
					stopped: true,
					filename: `export-dependencies/${clientCode}/${exportId}/${entity}/${uuid1}.ndjson.gz`,
					pageSize: 1,
					rowsPerFile: 1,
					rowsCount: 1,
					lastId: '693beee89a9dde1d3edcf2c9',
					dateStart: currentDate.toISOString(),
					dateEnd: new Date().toISOString()
				})
			}]);

			sinon.assert.notCalled(IterativeSQSConsumer.prototype.addFailedMessage);
		});
	});

	describe('startPart', () => {

		it('Should number parts from record.startPart when provided', async () => {

			class ProductApiList extends ApiListData {}

			mockRequire(apiListPath, ProductApiList);

			sinon.stub(ProductModel.prototype, 'getPaged')
				.callsFake((params, callback) => callback.call(null, [
					{ id: '693beee89a9dde1d3edcf2c9', name: 'Product 1' },
					{ id: '693beee89a9dde1d3edcf2ca', name: 'Product 2' }
				]));

			const event = createEvent(sqsQueueArn, clientCode, [{
				exportId,
				entity,
				params: EJSON.stringify({}),
				keyPrefix: `export-dependencies/${clientCode}/${exportId}/${entity}/`,
				shouldFormatRows: true,
				queueUrl,
				errorQueueUrl,
				startPart: 4,
				messageData: {
					exportId,
					entity
				}
			}]);

			await SQSHandler.handle(ExportConsumer, event);

			assertSendMessage([{
				QueueUrl: queueUrl,
				MessageBody: JSON.stringify({
					exportId,
					entity,
					part: 4,
					isLastPart: true,
					filename: `export-dependencies/${clientCode}/${exportId}/${entity}/${uuid1}.ndjson.gz`,
					pageSize: 10000,
					rowsPerFile: 250000,
					rowsCount: 2,
					lastId: '693beee89a9dde1d3edcf2ca',
					dateStart: currentDate.toISOString(),
					dateEnd: currentDate.toISOString()
				})
			}]);
		});
	});

	describe('Error handling', () => {
		it('Should add failed message and send message to error queue when error occurs', async () => {

			class ProductApiList extends ApiListData {}

			mockRequire(apiListPath, ProductApiList);

			sinon.stub(ProductModel.prototype, 'getPaged').throws(new Error('Get paged error'));

			await SQSHandler.handle(ExportConsumer, validEvent);

			sinon.assert.calledOnceWithExactly(ProductModel.prototype.getPaged, { page: 1, limit: 10000 }, sinon.match.func);

			assertSendMessage([{
				QueueUrl: errorQueueUrl,
				MessageBody: JSON.stringify({
					// ...messageData
					exportId,
					entity,
					//
					errorMessage: 'Get paged error',
					isRetryable: true
				})
			}]);

			sinon.assert.calledOnceWithExactly(IterativeSQSConsumer.prototype.addFailedMessage, validEvent.Records[0].messageId);
		});

		it('Should send a real callback error (not sentinel) to the error queue, keeping the current flow', async () => {

			class ProductApiList extends ApiListData {}

			mockRequire(apiListPath, ProductApiList);

			sinon.stub(ProductModel.prototype, 'getPaged')
				.callsFake(async (params, callback) => {
					await callback.call(null, [
						{ id: '693beee89a9dde1d3edcf2c9', name: 'Product 1' }
					]);
					throw new Error('Real cursor error');
				});

			await SQSHandler.handle(ExportConsumer, validEvent);

			assertSendMessage([{
				QueueUrl: errorQueueUrl,
				MessageBody: JSON.stringify({
					exportId,
					entity,
					errorMessage: 'Real cursor error',
					isRetryable: true
				})
			}]);

			sinon.assert.calledOnceWithExactly(IterativeSQSConsumer.prototype.addFailedMessage, validEvent.Records[0].messageId);
		});

		it('Should send a wrapped error whose previousError is not the sentinel to the error queue', async () => {

			class ProductApiList extends ApiListData {}

			mockRequire(apiListPath, ProductApiList);

			sinon.stub(ProductModel.prototype, 'getPaged')
				.callsFake(async () => {
					const wrapped = new Error('MongoDB error');
					wrapped.name = 'MongoDBError';
					wrapped.previousError = new Error('Some other failure');
					throw wrapped;
				});

			await SQSHandler.handle(ExportConsumer, validEvent);

			assertSendMessage([{
				QueueUrl: errorQueueUrl,
				MessageBody: JSON.stringify({
					exportId,
					entity,
					errorMessage: 'MongoDB error',
					isRetryable: true
				})
			}]);

			sinon.assert.calledOnceWithExactly(IterativeSQSConsumer.prototype.addFailedMessage, validEvent.Records[0].messageId);
		});

		it('Should add failed message and send message to error queue when error occurs assuming role', async () => {

			stsMock.on(AssumeRoleCommand).rejects(new Error('Assume role error'));

			sinon.stub(ProductModel.prototype, 'getPaged');

			await SQSHandler.handle(ExportConsumer, validEvent);

			sinon.assert.notCalled(ProductModel.prototype.getPaged);

			assertSendMessage([]);

			sinon.assert.calledOnceWithExactly(IterativeSQSConsumer.prototype.addFailedMessage, validEvent.Records[0].messageId);
		});

		it('Should add failed message and send message to error queue when assume role returning null', async () => {

			stsMock.on(AssumeRoleCommand).resolves({ Credentials: null });

			sinon.stub(ProductModel.prototype, 'getPaged');

			await SQSHandler.handle(ExportConsumer, validEvent);

			sinon.assert.notCalled(ProductModel.prototype.getPaged);

			assertSendMessage([]);

			sinon.assert.calledOnceWithExactly(IterativeSQSConsumer.prototype.addFailedMessage, validEvent.Records[0].messageId);
		});

		it('Should not process when invalid record received', async () => {

			sinon.stub(ProductModel.prototype, 'getPaged');

			await SQSHandler.handle(ExportConsumer, createEvent(sqsQueueArn, clientCode, [{}]));

			sinon.assert.notCalled(ProductModel.prototype.getPaged);

			sinon.assert.notCalled(IterativeSQSConsumer.prototype.addFailedMessage);
		});
	});
});
