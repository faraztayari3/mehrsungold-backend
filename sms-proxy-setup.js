// SMS Proxy - Forward SMS requests from port 3003 to 3004
const { createProxyMiddleware } = require('http-proxy-middleware');

function setupSmsProxy(app) {
    const smsProxy = createProxyMiddleware({
        target: 'http://localhost:3004',
        changeOrigin: true,
        pathFilter: ['/settings/sms'],
        on: {
            proxyReq: (proxyReq, req, res) => {
                console.log('[SMS Proxy] Forwarding:', req.method, req.url);
            },
            proxyRes: (proxyRes, req, res) => {
                console.log('[SMS Proxy] Response:', proxyRes.statusCode);
            },
            error: (err, req, res) => {
                console.error('[SMS Proxy] Error:', err.message);
                res.writeHead(500, {
                    'Content-Type': 'application/json',
                });
                res.end(JSON.stringify({ 
                    message: 'SMS Proxy Error: ' + err.message,
                    statusCode: 500
                }));
            }
        }
    });

    // Apply proxy middleware
    app.use('/settings/sms', smsProxy);
    console.log('[SMS Proxy] SMS proxy setup complete - forwarding /settings/sms to port 3004');
}

module.exports = { setupSmsProxy };
