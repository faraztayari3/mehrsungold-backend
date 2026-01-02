'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

function loadEnvFile(fileName, options) {
	const envPath = path.join(__dirname, fileName);
	if (!fs.existsSync(envPath)) return false;
	dotenv.config({ path: envPath, ...options });
	return true;
}

// Load env in a dev-friendly order without forcing edits to `.env`.
// - `.env` as base (no override)
// - `.env.<NODE_ENV>` and `.env.local` override values for local/dev
loadEnvFile('.env', { override: false });
if (process.env.NODE_ENV) {
	loadEnvFile(`.env.${process.env.NODE_ENV}`, { override: true });
}
loadEnvFile('.env.local', { override: true });

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

require('./main-enhanced.js');
