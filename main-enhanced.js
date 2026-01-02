// Enhanced main.js - Add custom routes via middleware injection
const dashboardController = require('./dashboard/dashboard.controller');
const { setupSmsProxy } = require('./sms-proxy-setup');
const path = require('path');
const fs = require('fs');

const controller = new dashboardController.DashboardController();

// Capture the Nest app instance without modifying the obfuscated main.js.
// main.js calls NestFactory.create(...). We monkey-patch it to store the app.
try {
    const nestCore = require('@nestjs/core');
    const originalCreate = nestCore.NestFactory.create;

    if (!global.__nestCreatePatched) {
        nestCore.NestFactory.create = async (...args) => {
            const app = await originalCreate.apply(nestCore.NestFactory, args);
            global.__nestApp = app;
            return app;
        };
        global.__nestCreatePatched = true;
    }
} catch (error) {
    // If patching fails, the server can still boot normally.
    console.error('[Main Enhanced] Failed to patch NestFactory.create:', error.message);
}

// First require main.js to start the app
require('./main.js');

// Then after a delay, inject extra Express routes/middlewares
setTimeout(() => {
    try {
        if (!global.__nestApp) {
            console.warn('[Main Enhanced] Nest app instance not available; skipping injections');
            return;
        }

        // Ensure CORS is configured for the production panel domain.
        // main.js currently calls enableCors() with defaults, but we want explicit origins + credentials
        // so preflight requests from https://panel.mehrsun.gold do not get blocked.
        if (!global.__corsConfigured) {
            const allowedOrigins = [
                'https://panel.mehrsun.gold',
                'https://mehrsun.gold',
                'https://www.mehrsun.gold',
                'http://localhost:3000',
                'http://localhost:3001',
                'http://localhost:3002',
            ];

            global.__nestApp.enableCors({
                origin: (origin, cb) => {
                    try {
                        if (!origin) return cb(null, true);
                        if (allowedOrigins.includes(origin)) return cb(null, true);
                        if (/^https:\/\/([a-z0-9-]+\.)?mehrsun\.gold$/i.test(origin)) return cb(null, true);
                        return cb(new Error('Not allowed by CORS'), false);
                    } catch (e) {
                        return cb(null, true);
                    }
                },
                credentials: true,
                methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
                maxAge: 86400,
            });

            global.__corsConfigured = true;
            console.log('[Main Enhanced] CORS configured');
        }

        const httpAdapter = global.__nestApp.getHttpAdapter();
        const app = httpAdapter.getInstance();

        // Add dashboard route
        app.get('/dashboard/weekly-metals', (req, res) => controller.getWeeklyMetals(req, res));

        // Add SMS proxy routes (GET/PUT /settings/sms, /sms/*, /health)
        setupSmsProxy(app);

        // Serve generated transaction export reports
        // TransactionService writes files to `${FILES_PATH}/report/<token>.xlsx` and stores `${BASE_URL}/report/<token>.xlsx` in DB.
        // Ensure `/report/*` is always resolvable even if ServeStaticModule rootPath differs between environments.
        try {
            let filesPath = process.env.FILES_PATH;
            try {
                const { ConfigService } = require('@nestjs/config');
                const configService = global.__nestApp.get(ConfigService);
                filesPath = filesPath || configService.get('FILES_PATH');
            } catch (e) {
                // ignore
            }

            const candidates = [
                filesPath ? path.join(filesPath, 'report') : null,
                path.join(__dirname, 'public', 'report'),
                path.join(__dirname, '..', 'public', 'report'),
            ].filter(Boolean);

            const reportDir = candidates.find((p) => {
                try {
                    return fs.existsSync(p) && fs.statSync(p).isDirectory();
                } catch (e) {
                    return false;
                }
            });

            if (reportDir) {
                // eslint-disable-next-line global-require
                const express = require('express');
                app.use(
                    '/report',
                    express.static(reportDir, {
                        index: false,
                        fallthrough: true,
                        setHeaders: (res) => {
                            res.setHeader('Access-Control-Allow-Origin', '*');
                            res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
                        },
                    }),
                );
                console.log(`[Main Enhanced] Report files served at /report from: ${reportDir}`);
            } else {
                console.warn('[Main Enhanced] Report directory not found; /report downloads may fail');
            }
        } catch (e) {
            console.error('[Main Enhanced] Failed to configure /report static serving:', e.message);
        }

        // SuperAdmin-only Admin deletion endpoint.
        // We add a dedicated route instead of modifying the obfuscated user service/controller.
        // Route: DELETE /user/:id/superadmin-delete
        if (!global.__superAdminDeleteAdminRouteAdded) {
            try {
                // eslint-disable-next-line global-require
                const { JwtService } = require('@nestjs/jwt');
                // eslint-disable-next-line global-require
                const { getModelToken } = require('@nestjs/mongoose');
                // eslint-disable-next-line global-require
                const { I18nService } = require('nestjs-i18n');

                const jwtService = global.__nestApp.get(JwtService);
                const i18n = global.__nestApp.get(I18nService);

                const userModel = global.__nestApp.get(getModelToken('User'));
                const cardModel = global.__nestApp.get(getModelToken('Card'));
                let balanceLogModel;
                try {
                    balanceLogModel = global.__nestApp.get(getModelToken('BalanceLog'));
                } catch (e) {
                    balanceLogModel = null;
                }

                const t = (key) => {
                    try {
                        return i18n.t(key);
                    } catch (e) {
                        return key;
                    }
                };

                const send = (res, statusCode, message) => {
                    return res.status(statusCode).json({ statusCode, message });
                };

                const getBearerToken = (req) => {
                    const header = req.headers?.authorization || req.headers?.Authorization;
                    if (!header || typeof header !== 'string') return null;
                    const match = /^Bearer\s+(.+)$/i.exec(header);
                    return match ? match[1] : null;
                };

                app.delete('/user/:id/superadmin-delete', async (req, res) => {
                    try {
                        const token = getBearerToken(req);
                        if (!token) return send(res, 401, 'Unauthorized');

                        let payload;
                        try {
                            payload = jwtService.verify(token);
                        } catch (e) {
                            return send(res, 401, 'Unauthorized');
                        }

                        const requesterId = payload?.userId || payload?.sub || payload?.id || payload?._id;
                        if (!requesterId) return send(res, 403, 'Forbidden');

                        const requester = await userModel.findById(requesterId).lean();
                        if (!requester || requester.role !== 'SuperAdmin') return send(res, 403, 'Forbidden');

                        const targetId = req.params.id;
                        const target = await userModel.findById(targetId).lean();
                        if (!target) return send(res, 404, t('errors.user.notFound'));

                        if (target.role === 'SuperAdmin') {
                            return send(res, 400, t('errors.user.cannotDeleteUser'));
                        }

                        // This endpoint is intentionally scoped to deleting Admin users only.
                        if (target.role !== 'Admin') {
                            return send(res, 400, t('errors.user.cannotDeleteUser'));
                        }

                        if (balanceLogModel) {
                            const lastBalanceLog = await balanceLogModel.findOne({ user: targetId }).lean();
                            if (lastBalanceLog) {
                                return send(res, 400, t('errors.user.cannotDeleteUser'));
                            }
                        }

                        await userModel.findByIdAndDelete(targetId);
                        await cardModel.deleteMany({ user: targetId });

                        return res.json({ message: 'Deleted' });
                    } catch (e) {
                        return send(res, 500, 'Internal Server Error');
                    }
                });

                global.__superAdminDeleteAdminRouteAdded = true;
                console.log('[Main Enhanced] SuperAdmin delete-admin route added: DELETE /user/:id/superadmin-delete');
            } catch (e) {
                console.error('[Main Enhanced] Failed to add SuperAdmin delete-admin route:', e.message);
            }
        }

        console.log('[Main Enhanced] Extra routes added via injection');
    } catch (error) {
        console.error('[Main Enhanced] Failed to inject routes:', error.message);
    }
}, 3000); // Wait 3 seconds for app to fully initialize
