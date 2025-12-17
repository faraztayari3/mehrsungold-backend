// SMS Proxy - Forward SMS requests from this API server to the SMS standalone server
const { createProxyMiddleware } = require('http-proxy-middleware');

function getSmsProxyTarget() {
    // Prefer explicit URL; fall back to local SMS_PORT (or 3005).
    const explicitTarget = process.env.SMS_PROXY_TARGET || process.env.SMS_STANDALONE_URL || process.env.SMS_API_INTERNAL_URL;
    if (explicitTarget) return explicitTarget;

    const smsPort = process.env.SMS_PORT || process.env.SMS_STANDALONE_PORT || '3005';
    return `http://127.0.0.1:${smsPort}`;
}

function setupSmsProxy(app) {
    if (!app) return;
    if (global.__smsProxySetupDone) return;
    global.__smsProxySetupDone = true;

    const target = getSmsProxyTarget();

    const onError = (err, req, res) => {
        console.error('[SMS Proxy] Error:', err && err.message ? err.message : err);
        if (res.headersSent) return;
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            message: 'SMS Proxy Error: ' + (err && err.message ? err.message : String(err)),
            statusCode: 502,
        }));
    };

    const makeProxy = (pathLabel) =>
        createProxyMiddleware({
            target,
            changeOrigin: true,
            xfwd: true,
            on: {
                proxyReq: (_proxyReq, req) => {
                    console.log('[SMS Proxy] Forwarding:', req.method, req.originalUrl || req.url, '->', target, pathLabel);
                },
                proxyRes: (proxyRes, req) => {
                    console.log('[SMS Proxy] Response:', proxyRes.statusCode, req.method, req.originalUrl || req.url);
                },
                error: onError,
            },
        });

    // /settings/sms (GET/PUT)
    app.use('/settings/sms', makeProxy('/settings/sms'));

    // /sms/* (send single/bulk, scheduled, etc.)
    app.use('/sms', makeProxy('/sms'));

    // Optional health endpoint passthrough
    app.use('/health', makeProxy('/health'));

    console.log('[SMS Proxy] SMS proxy setup complete - target:', target);
}

module.exports = { setupSmsProxy, getSmsProxyTarget };
