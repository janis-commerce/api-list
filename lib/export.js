/* eslint-disable global-require */
/* eslint-disable import/no-dynamic-require */

'use strict';

const { LambdaWithClientAndPayload } = require('@janiscommerce/lambda');
const { struct } = require('@janiscommerce/superstruct');
const path = require('path');
const { createGzip } = require('zlib');
const { PassThrough } = require('stream');
const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');

const ApiListError = require('./api-list-error');

const s3 = new S3Client();

const mainStruct = struct.partial({
	entity: 'string&!empty',
	parentEntity: 'string?',
	params: 'object',
	bucket: 'string&!empty',
	key: 'string&!empty'
});

module.exports = class Export extends LambdaWithClientAndPayload {

	get struct() {
		return mainStruct;
	}

	async process() {

		this.validateModel();
		this.validateApiList();

		const gzip = createGzip({ level: 6 });
		const pass = new PassThrough();

		const uploader = new Upload({
			client: s3,
			params: {
				Bucket: this.data.bucket,
				Key: `${this.data.key}.ndjson.gz`,
				Body: pass.pipe(gzip),
				ContentType: 'application/gzip',
				ContentEncoding: 'gzip'
			}
		});

		const params = {
			...this.data.params,
			page: 1,
			limit: this.pageSizeByEntity?.[this.data.entity] || this.pageSize || 5000
		};

		await this.model.getPaged(params, async rows => {

			if(this.apiList.formatRows)
				rows = await this.apiList.formatRows(rows);

			for(const row of rows)
				pass.write(JSON.stringify(row) + '\n');
		});

		pass.end();

		await uploader.done();
	}

	validateModel() {

		try {

			const modelPath = path.join(process.cwd(), process.env.MS_PATH || '', 'models', this.data.entity);

			const Model = require(modelPath);

			this.model = this.session.getSessionInstance(Model);

		} catch(error) {
			throw new ApiListError(error, ApiListError.codes.INVALID_ENTITY);
		}
	}

	validateApiList() {

		try {

			const apiListPath = path.join(process.cwd(), process.env.MS_PATH || '', 'api', this.data.parentEntity || '', this.data.entity, 'list.js');

			const ApiList = require(apiListPath);

			this.apiList = this.session.getSessionInstance(ApiList);

		} catch(error) {
			throw new ApiListError(error, ApiListError.codes.INVALID_ENTITY);
		}
	}
};
