'use strict';

const MicroserviceCall = require('@janiscommerce/microservice-call');

const { IterativeSQSConsumer } = require('@janiscommerce/sqs-consumer');

// Record: { exportId, entity, parentEntity, params, userId, bucket, keyPrefix, queueUrl, messageData }

module.exports = class ExportDLQConsumer extends IterativeSQSConsumer {

	async processSingleRecord(record, logger) {

		if(!record.body?.exportId) {
			logger.error('Invalid record', record);
			return;
		}

		const microserviceCall = this.session.getSessionInstance(MicroserviceCall);

		await microserviceCall.safeCall('export', 'export-error', 'post', { ...record.body }, {}, { id: record.body.exportId });
	}
};
