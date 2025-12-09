// Enhanced main.js - Add custom routes via middleware injection
const dashboardController = require('./dashboard/dashboard.controller');
const controller = new dashboardController.DashboardController();

// First require main.js to start the app
require('./main.js');

// Then after a delay, try to inject routes via global object
setTimeout(() => {
    try {
        // Try to get the Express app instance from global scope
        if (global.__nestApp) {
            const httpAdapter = global.__nestApp.getHttpAdapter();
            const app = httpAdapter.getInstance();
            
            // Add dashboard route
            app.get('/dashboard/weekly-metals', (req, res) => controller.getWeeklyMetals(req, res));
            
            console.log('[Main Enhanced] Dashboard routes added via global injection');
        }
    } catch (error) {
        console.error('[Main Enhanced] Failed to inject routes:', error.message);
    }
}, 3000); // Wait 3 seconds for app to fully initialize
