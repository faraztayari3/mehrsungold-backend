'use strict';

// Chabokan-friendly single entrypoint:
// - Starts the SMS standalone server (internal only)
// - Starts the main NestJS API using the enhanced+patched entrypoint
//
// This avoids needing a separate Chabokan service/port for SMS.

const { spawn } = require('child_process');

// Keep local defaults aligned with frontend .env.development/.env.example.
// In production Chabokan will pass PORT explicitly.
const DEFAULT_API_PORT = 3003;
const DEFAULT_SMS_PORT = 3005;

function ensureEnvDefaults() {
	if (!process.env.PORT) process.env.PORT = String(DEFAULT_API_PORT);
	if (!process.env.SMS_PORT) process.env.SMS_PORT = String(DEFAULT_SMS_PORT);
	if (!process.env.SMS_STANDALONE_PORT) process.env.SMS_STANDALONE_PORT = process.env.SMS_PORT;
	if (!process.env.SMS_PROXY_TARGET && !process.env.SMS_STANDALONE_URL && !process.env.SMS_API_INTERNAL_URL) {
		// Backend proxy will default to http://127.0.0.1:${SMS_PORT}
	}
}

function spawnNode(script, name) {
	const child = spawn(process.execPath, [script], {
		stdio: 'inherit',
		env: process.env,
	});
	child.on('exit', (code, signal) => {
		console.error(`[${name}] exited`, { code, signal });
		// If either process exits, exit the container so Chabokan restarts it.
		process.exit(code ?? 1);
	});
	return child;
}

ensureEnvDefaults();

const disableSmsStandalone = String(process.env.DISABLE_SMS_STANDALONE || '').toLowerCase() === 'true';

let smsChild = null;
if (!disableSmsStandalone) {
	smsChild = spawnNode('./sms-standalone-server.js', 'sms-standalone');
}

const apiChild = spawnNode('./main-enhanced-patched.js', 'backend');

function shutdown() {
	try {
		if (apiChild && !apiChild.killed) apiChild.kill('SIGTERM');
	} catch (_) {}
	try {
		if (smsChild && !smsChild.killed) smsChild.kill('SIGTERM');
	} catch (_) {}
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
