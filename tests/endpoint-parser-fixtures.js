'use strict';

const fixture = [];

fixture.push({
	description: 'It should throw if endpoint is empty',
	endpoint: '',
	error: true
});

fixture.push({
	description: 'It should throw if endpoint only has the rest api prefix',
	endpoint: '',
	error: true
});

fixture.push({
	description: 'It should throw if endpoint is not a list endpoint',
	endpoint: '/some-entity/1',
	error: true
});

fixture.push({
	description: 'It pass for a simple list endpoint',
	endpoint: '/some-entity',
	result: {
		modelName: 'some-entity',
		parents: {}
	}
});

fixture.push({
	description: 'It pass for a simple list endpoint with the api prefix',
	endpoint: '/api/some-entity',
	result: {
		modelName: 'some-entity',
		parents: {}
	}
});

fixture.push({
	description: 'It pass for a list endpoint with one parent',
	endpoint: '/some-parent/1/other-entity',
	result: {
		modelName: 'other-entity',
		parents: {
			someParent: '1'
		}
	}
});

fixture.push({
	description: 'It pass for a list endpoint with one parent with the api prefix',
	endpoint: '/api/some-parent/1/other-entity',
	result: {
		modelName: 'other-entity',
		parents: {
			someParent: '1'
		}
	}
});

fixture.push({
	description: 'It pass for a list endpoint with two parents',
	endpoint: '/some-parent/1/other-parent/5/other-entity',
	result: {
		modelName: 'other-entity',
		parents: {
			someParent: '1',
			otherParent: '5'
		}
	}
});

fixture.push({
	description: 'It pass for non numeric IDs',
	endpoint: '/some-parent/some-non-numeric-id/other-entity',
	result: {
		modelName: 'other-entity',
		parents: {
			someParent: 'some-non-numeric-id'
		}
	}
});

module.exports = fixture;
