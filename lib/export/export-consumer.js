/* eslint-disable max-len */
/* eslint-disable no-loop-func */
/* eslint-disable global-require */
/* eslint-disable import/no-dynamic-require */

'use strict';

const { IterativeSQSConsumer } = require('@janiscommerce/sqs-consumer');

const { STSClient, AssumeRoleCommand } = require('@aws-sdk/client-sts');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { S3Client } = require('@aws-sdk/client-s3');

const path = require('path');
const crypto = require('crypto');
const { EJSON } = require('bson');

const Uploader = require('../helpers/uploader');

const DEFAULT_PAGE_SIZE = 10000;
const MAX_PAGE_SIZE = 25000;
const DEFAULT_ROWS_PER_FILE = 250000;
const MAX_ROWS_PER_FILE = 250000;

// Record: { exportId, entity, parentEntity, params, userId, bucket, keyPrefix, queueUrl, messageData }

module.exports = class ExportConsumer extends IterativeSQSConsumer {

	get pageSize() {
		return DEFAULT_PAGE_SIZE;
	}

	get rowsPerFile() {
		return DEFAULT_ROWS_PER_FILE;
	}

	async processSingleRecord(record, logger) {

		this.logger = logger;

		if(!record.body?.exportId) {
			this.logger.error('Invalid record', record);
			return;
		}

		this.record = record.body;

		try {
			await this.prepareAwsClients();
			await this.process();
		} catch(error) {
			this.logger.error(`[${this.session.clientCode} - ${this.record.exportId}] Error processing record`, error);
			this.addFailedMessage(record.messageId);
			await this.sendMessageToErrorQueue(error);
		}
	}

	async process() {

		this.setApiListInstance();
		this.setModelInstance();

		let dateStart;
		let filename = null;

		let currentPart = 1;
		let rowsCount = 0;
		let totalRowsCount = 0;

		const { pageSize, rowsPerFile } = this.getPageSizeAndRowsPerFile();

		this.record.params = EJSON.parse(this.record.params);

		if(!Array.isArray(this.record.params))
			this.record.params = [this.record.params];

		for(const chunkParams of this.record.params) {

			const params = {
				...chunkParams,
				page: 1,
				limit: pageSize
			};

			dateStart = new Date().toISOString();

			await this.model.getPaged(params, async rows => {

				if(rowsCount >= rowsPerFile) {

					// previous page pending upload + send message

					await this.uploader.upload();

					await this.sendPartMessage(filename, currentPart, { pageSize, rowsPerFile, rowsCount }, dateStart);

					currentPart++;
					rowsCount = 0;

					dateStart = null;
				}

				if(!rowsCount) {

					filename = this.record.keyPrefix.endsWith('/')
						? `${this.record.keyPrefix}${crypto.randomUUID()}.ndjson.gz`
						: `${this.record.keyPrefix}/${crypto.randomUUID()}.ndjson.gz`;

					this.uploader = new Uploader(this.s3, this.record.bucket, filename);
				}

				if(this.record.shouldFormatRows && this.apiList.formatRows) {
					this.apiList.getParams = chunkParams; // some formatRows() needs params
					rows = await this.apiList.formatRows(rows);
				}

				for(const row of rows)
					this.uploader.add(row);

				rowsCount += rows.length;
				totalRowsCount += rows.length;

				if(!dateStart)
					dateStart = new Date().toISOString(); // 2nd file onwards
			});
		}

		if(rowsCount > 0) {

			await this.uploader.upload();

			await this.sendPartMessage(filename, currentPart, { pageSize, rowsPerFile, rowsCount }, dateStart, true);

		}

		if(totalRowsCount === 0)
			await this.sendPartMessage(null, currentPart, { pageSize, rowsPerFile, rowsCount: 0 }, dateStart, true);
	}

	getPageSizeAndRowsPerFile() {

		let pageSize = this.pageSizeByEntity?.[this.record.entity] || this.pageSize;

		if(pageSize > MAX_PAGE_SIZE) {
			this.logger.warn(`[${this.session.clientCode} - ${this.record.exportId}] Page size is greater than max page size, using max page size: ${MAX_PAGE_SIZE}`);
			pageSize = MAX_PAGE_SIZE;
		}

		let rowsPerFile = this.rowsPerFileByEntity?.[this.record.entity] || this.rowsPerFile;

		if(rowsPerFile > MAX_ROWS_PER_FILE) {
			this.logger.warn(`[${this.session.clientCode} - ${this.record.exportId}] Rows per file is greater than max rows per file, using max rows per file: ${MAX_ROWS_PER_FILE}`);
			rowsPerFile = MAX_ROWS_PER_FILE;
		}

		if(rowsPerFile < pageSize) {
			this.logger.warn(`[${this.session.clientCode} - ${this.record.exportId}] Rows per file is less than page size, using page size: ${pageSize} as rows per file`);
			rowsPerFile = pageSize;
		}

		return { pageSize, rowsPerFile };
	}

	async sendPartMessage(filename, currentPart, { pageSize, rowsPerFile, rowsCount }, dateStart, isLastPart = false) {

		return this.sqs.send(new SendMessageCommand({
			QueueUrl: this.record.queueUrl,
			MessageAttributes: {
				'janis-client': {
					DataType: 'String',
					StringValue: this.session.clientCode
				}
			},
			MessageBody: JSON.stringify({
				...this.record.messageData,
				part: currentPart,
				isLastPart,
				...filename && { filename },
				pageSize,
				rowsPerFile,
				rowsCount,
				dateStart,
				dateEnd: new Date().toISOString()
			})
		}));
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

		this.s3 = new S3Client({ credentials });
		this.sqs = new SQSClient({ credentials });
	}

	setApiListInstance() {

		const apiListPath = path.join(process.cwd(), process.env.MS_PATH || '', 'api', this.record.parentEntity || '', this.record.entity, 'list.js');

		const ApiList = require(apiListPath);

		this.apiList = this.session.getSessionInstance(ApiList);
		this.apiList.isExport = true;
	}

	setModelInstance() {

		const modelPath = path.join(process.cwd(), process.env.MS_PATH || '', 'models', this.apiList.modelName || this.record.entity);

		const Model = require(modelPath);

		this.model = this.session.getSessionInstance(Model);
	}

	async sendMessageToErrorQueue(error) {

		if(!this.sqs)
			return; // Assume Role error

		return this.sqs.send(new SendMessageCommand({
			QueueUrl: this.record.errorQueueUrl,
			MessageAttributes: {
				'janis-client': {
					DataType: 'String',
					StringValue: this.session.clientCode
				}
			},
			MessageBody: JSON.stringify({
				...this.record.messageData,
				errorMessage: error.message,
				isRetryable: true
			})
		}));
	}
};
