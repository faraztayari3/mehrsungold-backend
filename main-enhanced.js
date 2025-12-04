// Enhanced main.js with SMS proxy and hooks
const { setupSmsProxy } = require('./sms-proxy-setup');
const { setupSmsHooks } = require('./sms-hooks');

// Monkey patch NestFactory.create to add SMS features after app creation
const core = require('@nestjs/core');
const originalCreate = core.NestFactory.create;

core.NestFactory.create = async function(...args) {
    const app = await originalCreate.apply(this, args);
    
    // Add SMS proxy and hooks to the Express instance
    const httpAdapter = app.getHttpAdapter();
    const instance = httpAdapter.getInstance();
    
    setupSmsProxy(instance);
    setupSmsHooks(instance);
    
    console.log('[Main Enhanced] SMS Proxy and Hooks added to application');
    
    return app;
};

// Now require the original main.js to trigger bootstrap
require('./main.js');
