'use strict';

const { struct } = require('@janiscommerce/superstruct');

module.exports = class ListFields {

	constructor({ fields, excludeFields }, fieldsToSelect, fieldsToExclude, fixedFields) {
		this.fields = fields;
		this.excludeFields = excludeFields;
		this.fieldsToSelect = fieldsToSelect;
		this.fieldsToExclude = fieldsToExclude;
		this.fixedFields = fixedFields;
	}

	struct() {
		return {
			fields: struct.optional(['string']),
			excludeFields: struct.optional(['string'])
		};
	}

	getParams({ fields, excludeFields }) {

		let fieldsForQuery = [];
		let excludeFieldsForQuery = [];

		// fields y excludeFields es lo que se recibe en la request
		// this.fieldsToSelect es lo que el MS definio que se debe pedir "como maximo"
		// this.fieldsToExclude es lo que el MS definio que nunca se debe poder pedir (se deben sacar de fields si llegan)
		// this.fixedFields es lo que el MS definio que SIEMPRE tiene que devolverse (no se pueden sacar)

		if(fields) {
			fieldsForQuery = [
				...fields.filter(field => this.canSelectField(field)),
				...this.fixedFields ? [this.fixedFields] : []
			];
		} else if(this.fieldsToSelect) {

			fieldsForQuery = this.fieldsToSelect.filter(field => {

				if(excludeFields?.includes(field) && (this.fixedFields && !this.fixedFields.includes(field)))
					return false;

				return true;
			});

		} else if(excludeFields) {

			excludeFieldsForQuery = [
				...excludeFields,
				...this.fieldsToExclude ? [this.fieldsToExclude] : []
			].filter(field => !this.fixedFields?.includes(field));

		} else if(this.fieldsToExclude)
			excludeFieldsForQuery = this.fieldsToExclude.filter(field => !this.fixedFields?.includes(field));

		return {
			...fieldsForQuery.length && { fields: [...new Set(fieldsForQuery)] },
			...excludeFieldsForQuery.length && { excludeFields: [...new Set(excludeFieldsForQuery)] }
		};
	}

	canSelectField(field) {

		if(this.fieldsToSelect === false)
			return false;

		if(this.fieldsToSelect && !this.fieldsToSelect.includes(field))
			return false;

		if(this.fieldsToExclude && this.fieldsToExclude.includes(field))
			return false;

		return true;
	}

};
