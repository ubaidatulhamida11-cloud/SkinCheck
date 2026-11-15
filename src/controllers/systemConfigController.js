const systemConfigModel = require('../models/systemConfigModel');
const auditLogModel = require('../models/auditLogModel');
const loginActivityModel = require('../models/loginActivityModel');
const systemIntegrationService = require('../services/systemIntegrationService');
const loginNotificationService = require('../services/loginNotificationService');

class SystemConfigController {
    // ----------------------------------------------------
    // AI Configuration
    // ----------------------------------------------------
    renderAiConfigPage(req, res) {
        const fullSanitized = systemConfigModel.getSanitizedConfig();
        res.render('admin/layout', {
            page: 'config/ai',
            title: 'Konfigurasi AI Model & Assistant',
            ai: fullSanitized.ai,
            user: req.session.user
        });
    }

    async updateAiConfig(req, res) {
        try {
            const { active_provider, provider_settings, models, assistant } = req.body;

            // Basic validation
            const allowedProviders = ['gemini', 'openai', 'custom_ai', 'claude', 'local_knowledge'];
            if (active_provider && !allowedProviders.includes(active_provider)) {
                return res.status(400).json({
                    success: false,
                    message: `Provider '${active_provider}' tidak didukung. Pilih salah satu: ${allowedProviders.join(', ')}.`
                });
            }

            const updatedConfig = systemConfigModel.updateAiConfig({
                active_provider,
                provider_settings,
                models,
                assistant
            }, req.session.user);

            return res.json({
                success: true,
                message: 'Konfigurasi AI berhasil disimpan dan diterapkan.',
                ai: updatedConfig.ai
            });
        } catch (err) {
            console.error('[ConfigController] Error updating AI config:', err);
            return res.status(500).json({
                success: false,
                message: 'Gagal menyimpan konfigurasi AI: ' + err.message
            });
        }
    }

    async testAiConnection(req, res) {
        try {
            const { provider = 'gemini', modelId } = req.body;
            const result = await systemIntegrationService.testAiProvider(provider, modelId, req.session.user);
            return res.json(result);
        } catch (err) {
            return res.status(500).json({
                success: false,
                error: 'Kesalahan internal saat pengujian AI: ' + err.message
            });
        }
    }

    // ----------------------------------------------------
    // WhatsApp OTP Configuration
    // ----------------------------------------------------
    renderWhatsAppConfigPage(req, res) {
        const fullSanitized = systemConfigModel.getSanitizedConfig();
        const loginHistory = loginActivityModel.getAll(50);
        res.render('admin/layout', {
            page: 'config/whatsapp',
            title: 'Autentikasi WhatsApp OTP & Notifikasi Login',
            whatsapp: fullSanitized.whatsapp,
            loginHistory,
            user: req.session.user
        });
    }

    async updateWhatsAppConfig(req, res) {
        try {
            const { active_provider, fonnte, meta, otp_settings, login_notification } = req.body;

            if (active_provider && !['fonnte', 'meta', 'mock'].includes(active_provider)) {
                return res.status(400).json({
                    success: false,
                    message: `Provider WhatsApp '${active_provider}' tidak valid.`
                });
            }

            // OTP Settings validation
            if (otp_settings) {
                const exp = parseInt(otp_settings.expiration_seconds, 10);
                if (exp && (exp < 30 || exp > 1800)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Masa berlaku OTP harus antara 30 detik sampai 30 menit (1800 detik).'
                    });
                }
            }

            const updatedConfig = systemConfigModel.updateWhatsAppConfig({
                active_provider,
                fonnte,
                meta,
                otp_settings,
                login_notification
            }, req.session.user);

            return res.json({
                success: true,
                message: 'Konfigurasi WhatsApp berhasil disimpan.',
                whatsapp: updatedConfig.whatsapp
            });
        } catch (err) {
            console.error('[ConfigController] Error updating WhatsApp config:', err);
            return res.status(500).json({
                success: false,
                message: 'Gagal menyimpan konfigurasi WhatsApp: ' + err.message
            });
        }
    }

    async retryLoginNotification(req, res) {
        try {
            const activityId = req.params.id;
            const result = await loginNotificationService.retryNotification(activityId, req.session.user);
            return res.json(result);
        } catch (err) {
            console.error('[ConfigController] Error retrying login notification:', err);
            return res.status(500).json({
                success: false,
                message: 'Terjadi kesalahan sistem saat mengirim ulang: ' + err.message
            });
        }
    }

    async testWhatsAppConnection(req, res) {
        try {
            const { provider = 'fonnte', testPhone = null } = req.body;
            const result = await systemIntegrationService.testWhatsAppProvider(provider, testPhone, req.session.user);
            return res.json(result);
        } catch (err) {
            return res.status(500).json({
                success: false,
                error: 'Kesalahan saat pengujian WhatsApp: ' + err.message
            });
        }
    }

    // ----------------------------------------------------
    // Integration Status
    // ----------------------------------------------------
    renderIntegrationsPage(req, res) {
        const health = systemIntegrationService.getIntegrationHealth();
        const fullSanitized = systemConfigModel.getSanitizedConfig();
        res.render('admin/layout', {
            page: 'config/integrations',
            title: 'Status Integrasi Sistem',
            health,
            config: fullSanitized,
            user: req.session.user
        });
    }

    getIntegrationHealthApi(req, res) {
        const health = systemIntegrationService.getIntegrationHealth();
        res.json({ success: true, ...health });
    }

    // ----------------------------------------------------
    // Audit Log
    // ----------------------------------------------------
    renderAuditLogsPage(req, res) {
        const logs = auditLogModel.getLogs(200);
        res.render('admin/layout', {
            page: 'config/audit_logs',
            title: 'Audit Log Konfigurasi Sistem',
            logs,
            user: req.session.user
        });
    }
}

module.exports = new SystemConfigController();
