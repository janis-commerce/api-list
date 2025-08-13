/* eslint-disable no-loop-func */
/* eslint-disable global-require */
/* eslint-disable import/no-dynamic-require */

'use strict';

const { IterativeSQSConsumer } = require('@janiscommerce/sqs-consumer');

const { SqsEmitter } = require('@janiscommerce/sqs-emitter');

const crypto = require('crypto');

const path = require('path');
const { createGzip } = require('zlib');
const { PassThrough } = require('stream');
const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');

const s3 = new S3Client();

const MAX_ROWS_PER_FILE = 250000;
const MAX_PAGE_SIZE = 25000;

// Record: { exportId, entity, parentEntity, params, userId, bucket, keyPrefix, queueUrl, messageData }

module.exports = class ExportConsumer extends IterativeSQSConsumer {

	get pageSize() {
		return 10000;
	}

	get rowsPerFile() {
		return 250000;
	}

	async processSingleRecord(record, logger) {

		if(!record.body?.exportId) {
			logger.error('Invalid record', record);
			return;
		}

		this.record = record.body;

		this.validateModel();
		this.validateApiList();

		let gzip;
		let pass;
		let uploader;
		let dateStart;
		let filename = null;

		let currentPart = 1;
		let rowsCount = 0;

		const rowsPerFile = this.rowsPerFile > MAX_ROWS_PER_FILE ? MAX_ROWS_PER_FILE : this.rowsPerFile;

		if(!Array.isArray(this.record.params))
			this.record.params = [this.record.params];

		for(const chunkParams of this.record.params) {

			const params = {
				...chunkParams,
				page: 1,
				limit: this.pageSizeByEntity?.[this.record.entity] || this.pageSize
			};

			params.limit = params.limit > MAX_PAGE_SIZE ? MAX_PAGE_SIZE : params.limit;

			await this.model.getPaged(params, async rows => {

				if(rowsCount >= rowsPerFile) {

					// previous page pending upload + send message

					pass.end();
					await uploader.done();

					await this.sendPartMessage(filename, currentPart, rowsCount, rowsPerFile, dateStart);

					uploader = null;
					gzip = null;
					pass = null;

					currentPart++;
					rowsCount = 0;
				}

				if(!rowsCount) {

					dateStart = new Date().toISOString();

					filename = this.record.keyPrefix.endsWith('/')
						? `${this.record.keyPrefix}${crypto.randomUUID()}.ndjson.gz`
						: `${this.record.keyPrefix}/${crypto.randomUUID()}.ndjson.gz`;

					gzip = createGzip({ level: 6 });
					pass = new PassThrough();

					uploader = new Upload({
						client: s3,
						params: {
							Bucket: this.record.bucket,
							Key: filename,
							Body: pass.pipe(gzip),
							ContentType: 'application/gzip'
						}
					});
				}

				if(this.apiList.formatRows)
					rows = await this.apiList.formatRows(rows);

				for(const row of rows)
					pass.write(JSON.stringify(row) + '\n');

				rowsCount += rows.length;
			});
		}

		if(rowsCount > 0) {
			pass.end();
			await uploader.done();

			await this.sendPartMessage(filename, currentPart, rowsCount, rowsPerFile, dateStart, true);
		}
	}

	sendPartMessage(filename, currentPart, rowsCount, rowsPerFile, dateStart, isLastPart = false) {

		this.sqsEmitter ??= this.session.getSessionInstance(SqsEmitter);

		return this.sqsEmitter.publishEvent(
			this.record.queueUrl,
			{
				...this.record.messageData,
				part: currentPart,
				isLastPart,
				filename,
				rowsCount,
				rowsPerFile,
				dateStart,
				dateEnd: new Date().toISOString()
			}
		);
	}

	validateModel() {

		const modelPath = path.join(process.cwd(), process.env.MS_PATH || '', 'models', this.record.entity);

		const Model = require(modelPath);

		this.model = this.session.getSessionInstance(Model);
	}

	validateApiList() {

		const apiListPath = path.join(process.cwd(), process.env.MS_PATH || '', 'api', this.record.parentEntity || '', this.record.entity, 'list.js');

		const ApiList = require(apiListPath);

		this.apiList = this.session.getSessionInstance(ApiList);
	}
};
