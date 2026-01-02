'use strict';

// Prevent Mongoose from overwriting fields with `undefined` on updates.
// This is critical when controllers/services build update objects via destructuring
// where omitted optional DTO fields become `undefined`.
const mongoose = require('mongoose');

function stripUndefinedDeep(value) {
	if (!value || typeof value !== 'object') return;
	if (Array.isArray(value)) return;

	for (const key of Object.keys(value)) {
		if (value[key] === undefined) {
			delete value[key];
			continue;
		}

		stripUndefinedDeep(value[key]);
	}
}

mongoose.plugin((schema) => {
	const hooks = ['updateOne', 'updateMany', 'findOneAndUpdate'];

	for (const hook of hooks) {
		schema.pre(hook, function (next) {
			const update = this.getUpdate?.();
			if (update && typeof update === 'object') stripUndefinedDeep(update);
			next();
		});
	}
});

require('./main.js');
