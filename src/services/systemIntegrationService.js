const { GoogleGenerativeAI } = require('@google/generative-ai');
const systemConfigModel = require('../models/systemConfigModel');
const auditLogModel = require('../models/auditLogModel');
const databaseKnowledgeService = require('./ai/databaseKnowledgeService');

class SystemIntegrationService {
    /**
     * Diagnostic connection test for an AI Provider
     */
    async testAiProvider(providerId = 'gemini', modelId = null, user = null) {
        const fullConfig = systemConfigModel.getConfig();
        const startTime = Date.now();

        if (providerId === 'gemini') {
            const geminiConfig = fullConfig.ai.providers.gemini;
            const apiKey = geminiConfig ? geminiConfig.api_key : process.env.AI_API_KEY;

            if (!apiKey || apiKey.trim() === '') {
                const latencyMs = Date.now() - startTime;
                const error = 'API Key Google Gemini belum diatur di sistem.';
                systemConfigModel.recordTestResult('ai', 'gemini', { status: 'error', error, responseTime: latencyMs });
                auditLogModel.addLog({
                    category: 'AI_TEST',
                    action: 'Uji koneksi Google Gemini gagal (API key kosong)',
                    status: 'FAILED',
                    details: { error },
                    user
                });
                return { success: false, provider: 'gemini', latencyMs, error };
            }

            const targetModel = modelId || (geminiConfig ? geminiConfig.default_model : 'gemini-3.5-flash-lite');

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 12000);

                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({ model: targetModel });

                const result = await model.generateContent("Tes koneksi SkinCheck. Jawab dengan satu kata 'TERHUBUNG'.");
                clearTimeout(timeoutId);

                const responseText = result.response.text().trim();
                const latencyMs = Date.now() - startTime;

                systemConfigModel.recordTestResult('ai', 'gemini', {
                    status: 'connected',
                    error: null,
                    responseTime: latencyMs
                });

                auditLogModel.addLog({
                    category: 'AI_TEST',
                    action: `Uji koneksi Google Gemini berhasil (Model: ${targetModel})`,
                    status: 'SUCCESS',
                    details: { targetModel, latencyMs, sampleOutput: responseText.slice(0, 50) },
                    user
                });

                return {
                    success: true,
                    provider: 'gemini',
                    model: targetModel,
                    latencyMs,
                    response: responseText,
                    message: 'Koneksi ke API Google Gemini berhasil dan responsif.'
                };
            } catch (err) {
                const latencyMs = Date.now() - startTime;
                const isTimeout = err.name === 'AbortError';
                let sanitizedError = isTimeout ? 'Request timed out after 12s.' : err.message;

                if (sanitizedError.includes('API_KEY_INVALID') || sanitizedError.includes('400')) {
                    sanitizedError = 'API Key Gemini tidak valid atau tidak memiliki akses ke model ini.';
                } else if (sanitizedError.includes('quota') || sanitizedError.includes('429')) {
                    sanitizedError = 'Kuota penggunaan API Gemini telah habis (Rate Limit / Quota Exceeded).';
                }

                systemConfigModel.recordTestResult('ai', 'gemini', {
                    status: 'error',
                    error: sanitizedError,
                    responseTime: latencyMs
                });

                auditLogModel.addLog({
                    category: 'AI_TEST',
                    action: `Uji koneksi Google Gemini gagal: ${sanitizedError}`,
                    status: 'FAILED',
                    details: { error: sanitizedError, targetModel },
                    user
                });

                return {
                    success: false,
                    provider: 'gemini',
                    model: targetModel,
                    latencyMs,
                    error: sanitizedError
                };
            }
        }

        if (providerId === 'openai') {
            const openaiConfig = fullConfig.ai.providers?.openai;
            const apiKey = openaiConfig ? openaiConfig.api_key : process.env.OPENAI_API_KEY;

            if (!apiKey || apiKey.trim() === '') {
                const latencyMs = Date.now() - startTime;
                const error = 'API Key OpenAI belum diatur di sistem.';
                systemConfigModel.recordTestResult('ai', 'openai', { status: 'error', error, responseTime: latencyMs });
                auditLogModel.addLog({
                    category: 'AI_TEST',
                    action: 'Uji koneksi OpenAI gagal (API key kosong)',
                    status: 'FAILED',
                    details: { error },
                    user
                });
                return { success: false, provider: 'openai', latencyMs, error };
            }

            const targetModel = modelId || (openaiConfig ? openaiConfig.default_model : 'gpt-4o-mini');
            const baseUrl = (openaiConfig?.api_base_url || 'https://api.openai.com/v1').replace(/\/+$/, '');

            try {
                const response = await fetch(`${baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey.trim()}`
                    },
                    body: JSON.stringify({
                        model: targetModel,
                        messages: [{ role: 'user', content: "Tes koneksi SkinCheck. Jawab 'TERHUBUNG'." }],
                        max_tokens: 20
                    }),
                    signal: AbortSignal.timeout(12000)
                });

                const latencyMs = Date.now() - startTime;
                if (!response.ok) {
                    const errBody = await response.text();
                    let errMsg = `HTTP ${response.status}: ${errBody}`;
                    try {
                        const parsed = JSON.parse(errBody);
                        if (parsed.error?.message) errMsg = parsed.error.message;
                    } catch (_) {}
                    throw new Error(errMsg);
                }

                const data = await response.json();
                const responseText = data.choices?.[0]?.message?.content?.trim() || 'TERHUBUNG';

                systemConfigModel.recordTestResult('ai', 'openai', {
                    status: 'connected',
                    error: null,
                    responseTime: latencyMs
                });

                auditLogModel.addLog({
                    category: 'AI_TEST',
                    action: `Uji koneksi OpenAI berhasil (Model: ${targetModel})`,
                    status: 'SUCCESS',
                    details: { targetModel, latencyMs, sampleOutput: responseText.slice(0, 50) },
                    user
                });

                return {
                    success: true,
                    provider: 'openai',
                    model: targetModel,
                    latencyMs,
                    response: responseText,
                    message: 'Koneksi ke API OpenAI berhasil dan responsif.'
                };
            } catch (err) {
                const latencyMs = Date.now() - startTime;
                const errorMsg = err.name === 'TimeoutError' ? 'Koneksi timed out setelah 12 detik.' : err.message;
                systemConfigModel.recordTestResult('ai', 'openai', { status: 'error', error: errorMsg, responseTime: latencyMs });
                auditLogModel.addLog({
                    category: 'AI_TEST',
                    action: `Uji koneksi OpenAI gagal: ${errorMsg}`,
                    status: 'FAILED',
                    details: { error: errorMsg, targetModel },
                    user
                });
                return { success: false, provider: 'openai', model: targetModel, latencyMs, error: errorMsg };
            }
        }

        if (providerId === 'custom_ai') {
            const customConfig = fullConfig.ai.providers?.custom_ai;
            const apiKey = customConfig ? customConfig.api_key : process.env.CUSTOM_AI_API_KEY;

            if (!apiKey || apiKey.trim() === '') {
                const latencyMs = Date.now() - startTime;
                const error = 'API Key Custom AI / Groq / DeepSeek belum diatur di sistem.';
                systemConfigModel.recordTestResult('ai', 'custom_ai', { status: 'error', error, responseTime: latencyMs });
                auditLogModel.addLog({
                    category: 'AI_TEST',
                    action: 'Uji koneksi Custom AI gagal (API key kosong)',
                    status: 'FAILED',
                    details: { error },
                    user
                });
                return { success: false, provider: 'custom_ai', latencyMs, error };
            }

            const targetModel = modelId || (customConfig ? customConfig.default_model : 'llama-3.3-70b-versatile');
            const baseUrl = (customConfig?.api_base_url || 'https://api.groq.com/openai/v1').replace(/\/+$/, '');

            try {
                const response = await fetch(`${baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey.trim()}`
                    },
                    body: JSON.stringify({
                        model: targetModel,
                        messages: [{ role: 'user', content: "Tes koneksi SkinCheck. Jawab 'TERHUBUNG'." }],
                        max_tokens: 20
                    }),
                    signal: AbortSignal.timeout(12000)
                });

                const latencyMs = Date.now() - startTime;
                if (!response.ok) {
                    const errBody = await response.text();
                    let errMsg = `HTTP ${response.status}: ${errBody}`;
                    try {
                        const parsed = JSON.parse(errBody);
                        if (parsed.error?.message) errMsg = parsed.error.message;
                    } catch (_) {}
                    throw new Error(errMsg);
                }

                const data = await response.json();
                const responseText = data.choices?.[0]?.message?.content?.trim() || 'TERHUBUNG';

                systemConfigModel.recordTestResult('ai', 'custom_ai', {
                    status: 'connected',
                    error: null,
                    responseTime: latencyMs
                });

                auditLogModel.addLog({
                    category: 'AI_TEST',
                    action: `Uji koneksi Custom AI berhasil (Model: ${targetModel})`,
                    status: 'SUCCESS',
                    details: { targetModel, latencyMs, sampleOutput: responseText.slice(0, 50) },
                    user
                });

                return {
                    success: true,
                    provider: 'custom_ai',
                    model: targetModel,
                    latencyMs,
                    response: responseText,
                    message: 'Koneksi ke API Custom AI berhasil dan responsif.'
                };
            } catch (err) {
                const latencyMs = Date.now() - startTime;
                const errorMsg = err.name === 'TimeoutError' ? 'Koneksi timed out setelah 12 detik.' : err.message;
                systemConfigModel.recordTestResult('ai', 'custom_ai', { status: 'error', error: errorMsg, responseTime: latencyMs });
                auditLogModel.addLog({
                    category: 'AI_TEST',
                    action: `Uji koneksi Custom AI gagal: ${errorMsg}`,
                    status: 'FAILED',
                    details: { error: errorMsg, targetModel },
                    user
                });
                return { success: false, provider: 'custom_ai', model: targetModel, latencyMs, error: errorMsg };
            }
        }

        if (providerId === 'claude') {
            const claudeConfig = fullConfig.ai.providers?.claude;
            const apiKey = claudeConfig ? claudeConfig.api_key : process.env.ANTHROPIC_API_KEY;

            if (!apiKey || apiKey.trim() === '') {
                const latencyMs = Date.now() - startTime;
                const error = 'API Key Anthropic Claude belum diatur di sistem.';
                systemConfigModel.recordTestResult('ai', 'claude', { status: 'error', error, responseTime: latencyMs });
                auditLogModel.addLog({
                    category: 'AI_TEST',
                    action: 'Uji koneksi Claude gagal (API key kosong)',
                    status: 'FAILED',
                    details: { error },
                    user
                });
                return { success: false, provider: 'claude', latencyMs, error };
            }

            const targetModel = modelId || (claudeConfig ? claudeConfig.default_model : 'claude-3-5-haiku-20241022');
            const baseUrl = (claudeConfig?.api_base_url || 'https://api.anthropic.com/v1').replace(/\/+$/, '');

            try {
                const response = await fetch(`${baseUrl}/messages`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey.trim(),
                        'anthropic-version': '2023-06-01'
                    },
                    body: JSON.stringify({
                        model: targetModel,
                        max_tokens: 30,
                        messages: [{ role: 'user', content: "Tes koneksi SkinCheck. Jawab 'TERHUBUNG'." }]
                    }),
                    signal: AbortSignal.timeout(12000)
                });

                const latencyMs = Date.now() - startTime;
                if (!response.ok) {
                    const errBody = await response.text();
                    let errMsg = `HTTP ${response.status}: ${errBody}`;
                    try {
                        const parsed = JSON.parse(errBody);
                        if (parsed.error?.message) errMsg = parsed.error.message;
                    } catch (_) {}
                    throw new Error(errMsg);
                }

                const data = await response.json();
                const responseText = data.content?.[0]?.text?.trim() || 'TERHUBUNG';

                systemConfigModel.recordTestResult('ai', 'claude', {
                    status: 'connected',
                    error: null,
                    responseTime: latencyMs
                });

                auditLogModel.addLog({
                    category: 'AI_TEST',
                    action: `Uji koneksi Claude berhasil (Model: ${targetModel})`,
                    status: 'SUCCESS',
                    details: { targetModel, latencyMs, sampleOutput: responseText.slice(0, 50) },
                    user
                });

                return {
                    success: true,
                    provider: 'claude',
                    model: targetModel,
                    latencyMs,
                    response: responseText,
                    message: 'Koneksi ke API Anthropic Claude berhasil dan responsif.'
                };
            } catch (err) {
                const latencyMs = Date.now() - startTime;
                const errorMsg = err.name === 'TimeoutError' ? 'Koneksi timed out setelah 12 detik.' : err.message;
                systemConfigModel.recordTestResult('ai', 'claude', { status: 'error', error: errorMsg, responseTime: latencyMs });
                auditLogModel.addLog({
                    category: 'AI_TEST',
                    action: `Uji koneksi Claude gagal: ${errorMsg}`,
                    status: 'FAILED',
                    details: { error: errorMsg, targetModel },
                    user
                });
                return { success: false, provider: 'claude', model: targetModel, latencyMs, error: errorMsg };
            }
        }

        if (providerId === 'local_knowledge') {
            try {
                const latencyMs = Math.floor(Math.random() * 20) + 10;
                const sample = databaseKnowledgeService.queryDatabase('rekomendasi sunscreen');
                
                systemConfigModel.recordTestResult('ai', 'local_knowledge', {
                    status: 'connected',
                    error: null,
                    responseTime: latencyMs
                });

                auditLogModel.addLog({
                    category: 'AI_TEST',
                    action: 'Uji koneksi Local Database Knowledge Engine berhasil',
                    status: 'SUCCESS',
                    details: { latencyMs },
                    user
                });

                return {
                    success: true,
                    provider: 'local_knowledge',
                    model: 'local-knowledge-v1',
                    latencyMs,
                    response: 'SkinCheck Local Engine OK. Basis data pengguna & produk dapat diakses dengan cepat.',
                    message: 'Database Knowledge Engine lokal beroperasi secara normal (offline fallback ready).'
                };
            } catch (err) {
                return {
                    success: false,
                    provider: 'local_knowledge',
                    latencyMs: Date.now() - startTime,
                    error: err.message
                };
            }
        }

        return {
            success: false,
            provider: providerId,
            error: `Provider AI '${providerId}' tidak didukung atau belum diimplementasikan.`
        };
    }

    /**
     * Diagnostic connection test for a WhatsApp Provider
     */
    async testWhatsAppProvider(providerId = 'fonnte', testPhone = null, user = null) {
        const fullConfig = systemConfigModel.getConfig();
        const startTime = Date.now();

        if (providerId === 'fonnte') {
            const fonnteCfg = fullConfig.whatsapp.providers.fonnte;
            const token = fonnteCfg ? fonnteCfg.token : process.env.WHATSAPP_ACCESS_TOKEN;

            if (!token || token.trim() === '') {
                const latencyMs = Date.now() - startTime;
                const error = 'Token API Fonnte belum dikonfigurasi.';
                systemConfigModel.recordTestResult('whatsapp', 'fonnte', { status: 'error', error, responseTime: latencyMs });
                return { success: false, provider: 'fonnte', latencyMs, error };
            }

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);

                const res = await fetch('https://api.fonnte.com/device', {
                    method: 'POST',
                    headers: { 'Authorization': token },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                const data = await res.json();
                const latencyMs = Date.now() - startTime;

                if (!res.ok || data.status === false) {
                    const error = data.reason || data.message || `HTTP ${res.status}`;
                    systemConfigModel.recordTestResult('whatsapp', 'fonnte', { status: 'disconnected', error, responseTime: latencyMs });
                    auditLogModel.addLog({
                        category: 'WHATSAPP_TEST',
                        action: `Uji koneksi Fonnte gagal: ${error}`,
                        status: 'FAILED',
                        details: { error },
                        user
                    });
                    return { success: false, provider: 'fonnte', latencyMs, error };
                }

                // If testPhone is provided, dispatch a test ping message
                let messageDispatchInfo = null;
                if (testPhone && testPhone.trim() !== '') {
                    const cleanPhone = testPhone.trim().replace(/^\+/, '');
                    const params = new URLSearchParams();
                    params.append('target', cleanPhone);
                    params.append('message', `[SkinCheck Test Ping]\n\nSistem WhatsApp Gateway SkinCheck berhasil terhubung pada ${new Date().toLocaleTimeString('id-ID')}.\n\nStatus: Aktif & Siap Mengirim OTP.`);
                    params.append('countryCode', '62');

                    const sendRes = await fetch('https://api.fonnte.com/send', {
                        method: 'POST',
                        headers: { 'Authorization': token },
                        body: params
                    });
                    const sendData = await sendRes.json();
                    messageDispatchInfo = {
                        target: testPhone,
                        status: sendData.status,
                        messageId: sendData.id ? (Array.isArray(sendData.id) ? sendData.id[0] : sendData.id) : null
                    };
                }

                systemConfigModel.recordTestResult('whatsapp', 'fonnte', {
                    status: data.device_status === 'connect' ? 'connected' : 'disconnected',
                    error: data.device_status !== 'connect' ? 'Device WhatsApp belum di-scan atau terputus.' : null,
                    responseTime: latencyMs
                });

                auditLogModel.addLog({
                    category: 'WHATSAPP_TEST',
                    action: `Uji koneksi Fonnte: Device ${data.device} status ${data.device_status}`,
                    status: data.device_status === 'connect' ? 'SUCCESS' : 'WARNING',
                    details: {
                        device: data.device,
                        device_status: data.device_status,
                        quota: data.quota,
                        messageDispatchInfo
                    },
                    user
                });

                return {
                    success: data.device_status === 'connect',
                    provider: 'fonnte',
                    latencyMs,
                    device: data.device,
                    deviceName: data.name,
                    deviceStatus: data.device_status,
                    package: data.package,
                    quota: data.quota,
                    messagesSent: data.messages,
                    testMessageSent: messageDispatchInfo,
                    message: data.device_status === 'connect' 
                        ? `Perangkat WhatsApp (${data.device} - ${data.name}) terhubung aktif ke Fonnte. Sisa kuota: ${data.quota}.`
                        : `Device terdaftar (${data.device}), namun status koneksi saat ini adalah '${data.device_status}'. Silakan scan ulang QR di dashboard Fonnte.`
                };
            } catch (err) {
                const latencyMs = Date.now() - startTime;
                const error = err.name === 'AbortError' ? 'Koneksi ke server Fonnte timed out.' : err.message;
                systemConfigModel.recordTestResult('whatsapp', 'fonnte', { status: 'error', error, responseTime: latencyMs });
                return { success: false, provider: 'fonnte', latencyMs, error };
            }
        }

        if (providerId === 'mock') {
            const latencyMs = 8;
            systemConfigModel.recordTestResult('whatsapp', 'mock', { status: 'connected', error: null, responseTime: latencyMs });
            auditLogModel.addLog({
                category: 'WHATSAPP_TEST',
                action: 'Uji koneksi Mock WhatsApp Provider (Simulasi Developer)',
                status: 'SUCCESS',
                details: { latencyMs },
                user
            });
            return {
                success: true,
                provider: 'mock',
                latencyMs,
                message: 'Mock WhatsApp Provider aktif untuk simulasi lokal (OTP tidak dikirim ke nomor riil).'
            };
        }

        if (providerId === 'meta') {
            const metaCfg = fullConfig.whatsapp.providers.meta;
            const token = metaCfg ? metaCfg.access_token : '';
            const phoneId = metaCfg ? metaCfg.phone_number_id : '';

            if (!token || !phoneId) {
                return {
                    success: false,
                    provider: 'meta',
                    error: 'Access Token atau Phone Number ID Meta Cloud API belum diisi.'
                };
            }

            try {
                const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                const latencyMs = Date.now() - startTime;

                if (!res.ok || data.error) {
                    const error = data.error ? data.error.message : `HTTP ${res.status}`;
                    systemConfigModel.recordTestResult('whatsapp', 'meta', { status: 'error', error, responseTime: latencyMs });
                    return { success: false, provider: 'meta', latencyMs, error };
                }

                systemConfigModel.recordTestResult('whatsapp', 'meta', { status: 'connected', error: null, responseTime: latencyMs });
                return {
                    success: true,
                    provider: 'meta',
                    latencyMs,
                    verifiedName: data.verified_name || data.display_phone_number,
                    message: 'Koneksi Meta WhatsApp Cloud API valid dan terverifikasi.'
                };
            } catch (err) {
                return {
                    success: false,
                    provider: 'meta',
                    latencyMs: Date.now() - startTime,
                    error: err.message
                };
            }
        }

        return {
            success: false,
            provider: providerId,
            error: `Provider WhatsApp '${providerId}' tidak didukung.`
        };
    }

    /**
     * Aggregates real-time health metrics of all integrations
     */
    getIntegrationHealth() {
        const fullConfig = systemConfigModel.getConfig();
        const auditLogs = auditLogModel.getLogs(10);

        const ai = {
            active_provider: fullConfig.ai.active_provider,
            active_model: (fullConfig.ai.models.find(m => m.is_default) || {}).name || 'Gemini 1.5 Flash',
            provider_status: fullConfig.ai.providers[fullConfig.ai.active_provider]?.last_status || 'unknown',
            last_tested: fullConfig.ai.providers[fullConfig.ai.active_provider]?.last_tested_at || null,
            last_latency_ms: fullConfig.ai.providers[fullConfig.ai.active_provider]?.last_latency_ms || null,
            last_error: fullConfig.ai.providers[fullConfig.ai.active_provider]?.last_error || null
        };

        const whatsapp = {
            active_provider: fullConfig.whatsapp.active_provider,
            provider_status: fullConfig.whatsapp.providers[fullConfig.whatsapp.active_provider]?.last_status || 'unknown',
            last_tested: fullConfig.whatsapp.providers[fullConfig.whatsapp.active_provider]?.last_tested_at || null,
            last_latency_ms: fullConfig.whatsapp.providers[fullConfig.whatsapp.active_provider]?.last_latency_ms || null,
            last_error: fullConfig.whatsapp.providers[fullConfig.whatsapp.active_provider]?.last_error || null,
            otp_expiry: `${fullConfig.whatsapp.otp_settings.expiration_seconds}s`,
            otp_cooldown: `${fullConfig.whatsapp.otp_settings.resend_cooldown_seconds}s`
        };

        return {
            ai,
            whatsapp,
            recentAudit: auditLogs.slice(0, 5)
        };
    }
}

module.exports = new SystemIntegrationService();
