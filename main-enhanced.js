// Enhanced main.js with SMS proxy and hooks
const { setupSmsProxy } = require('./sms-proxy-setup');
const { setupSmsHooks } = require('./sms-hooks');
const { setupSmsRoutes } = require('./sms-routes');

// Monkey patch NestFactory.create to add SMS features after app creation
const core = require('@nestjs/core');
const originalCreate = core.NestFactory.create;

core.NestFactory.create = async function(...args) {
    const app = await originalCreate.apply(this, args);
    
    // Monkey patch listen to add routes after app is fully ready
    const originalListen = app.listen;
    app.listen = async function(...listenArgs) {
        // Add SMS features before listening
        const httpAdapter = app.getHttpAdapter();
        const instance = httpAdapter.getInstance();
        
        setupSmsRoutes(instance);  // Adds /dashboard/weekly-metals + /settings/sms endpoints
        setupSmsProxy(instance);   // Proxies /settings/sms to port 3004 (if needed)
        setupSmsHooks(instance);   // Auto-sends SMS after registration/deposit/withdrawal
        
        console.log('[Main Enhanced] SMS Routes, Proxy and Hooks added to application');
        
        return originalListen.apply(this, listenArgs);
    };
    
    return app;
};

// Now require the original main.js to trigger bootstrap
require('./main.js');
