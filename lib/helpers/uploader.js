'use strict';

const { Upload } = require('@aws-sdk/lib-storage');

const { createGzip } = require('zlib');
const { PassThrough } = require('stream');

module.exports = class Uploader {

	constructor(s3, bucket, key) {

		const gzip = createGzip({ level: 6 });
		this.pass = new PassThrough();

		this.uploader = new Upload({
			client: s3,
			params: {
				Bucket: bucket,
				Key: key,
				Body: this.pass.pipe(gzip),
				ContentType: 'application/gzip'
			}
		});
	}

	add(row) {
		this.pass.write(JSON.stringify(row) + '\n');
	}

	async upload() {
		this.pass.end();
		await this.uploader.done();
		this.uploader = null;
		this.pass = null;
	}
};
