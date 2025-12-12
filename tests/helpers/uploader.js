'use strict';

require('lllog')('none');

const sinon = require('sinon');

const { mockClient } = require('aws-sdk-client-mock');
const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { PassThrough } = require('stream');

const Uploader = require('../../lib/helpers/uploader');

describe('Uploader Helper', () => {

	const s3Mock = mockClient(S3Client);

	beforeEach(() => {

		sinon.stub(Upload.prototype, 'done').resolves({ Key: 'test-key' });

		sinon.stub(PassThrough.prototype, 'write');
		sinon.stub(PassThrough.prototype, 'end');
		sinon.stub(PassThrough.prototype, 'pipe');
	});

	afterEach(() => {

		sinon.assert.calledOnce(PassThrough.prototype.pipe);
		sinon.assert.calledOnce(PassThrough.prototype.end);
		sinon.assert.calledOnce(Upload.prototype.done);

		sinon.restore();
	});

	const assertPassThroughWrite = (calls = []) => {
		sinon.assert.callCount(PassThrough.prototype.write, calls.length);

		calls.forEach(call => {
			sinon.assert.calledWithExactly(PassThrough.prototype.write, call);
		});
	};

	it('Should add 3 rows and upload successfully', async () => {

		const uploader = new Uploader(s3Mock, 'test-bucket', 'test-key');

		const row1 = { id: 1, name: 'Product 1' };
		const row2 = { id: 2, name: 'Product 2' };
		const row3 = { id: 3, name: 'Product 3' };

		uploader.add(row1);
		uploader.add(row2);
		uploader.add(row3);

		await uploader.upload();

		assertPassThroughWrite([
			JSON.stringify(row1) + '\n',
			JSON.stringify(row2) + '\n',
			JSON.stringify(row3) + '\n'
		]);
	});

	it('Should upload without adding rows', async () => {

		const uploader = new Uploader(s3Mock, 'test-bucket', 'test-key');

		await uploader.upload();

		assertPassThroughWrite([]);
	});

});
