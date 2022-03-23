'use strict';

module.exports = (originalValue, valueMapper) => {

	if(!valueMapper)
		return originalValue;

	if(valueMapper.isCustom)
		return valueMapper.map(originalValue);

	return Array.isArray(originalValue) ? originalValue.map(valueMapper) : valueMapper(originalValue);
};
