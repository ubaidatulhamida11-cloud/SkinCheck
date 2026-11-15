const fs = require('fs');
const path = require('path');
const auditLogModel = require('./auditLogModel');

const configFilePath = path.join(__dirname, '../../data/system_config.json');

function maskSecret(val) {
    if (!val || typeof val !== 'string' || val.trim() === '') return '';
    const clean = val.trim();
    if (clean.length <= 6) return '••••••';
    const start = clean.slice(0, 4);
    const end = clean.slice(-4);
    return `${start}••••••••${end}`;
}

function isMaskedValue(val) {
    if (!val || typeof val !== 'string') return true;
    return val.includes('••••') || val.includes('****');
}

function getDefaultConfig() {
    return {
        ai: {
            active_provider: 'gemini',
            providers: {
                gemini: {
                    name: 'Google Gemini AI',
                    api_key: process.env.AI_API_KEY || '',
                    is_active: true,
                    default_model: 'gemini-3.5-flash-lite',
                    last_tested_at: null,
                    last_status: 'unknown',
                    last_error: null
                },
                openai: {
                    name: 'OpenAI (ChatGPT / GPT-4o)',
                    api_key: process.env.OPENAI_API_KEY || '',
                    api_base_url: 'https://api.openai.com/v1',
                    is_active: true,
                    default_model: 'gpt-4o-mini',
                    last_tested_at: null,
                    last_status: 'unknown',
                    last_error: null
                },
                custom_ai: {
                    name: 'Custom / OpenAI-Compatible (Groq, DeepSeek, OpenRouter)',
                    api_key: process.env.CUSTOM_AI_API_KEY || '',
                    api_base_url: 'https://api.groq.com/openai/v1',
                    is_active: true,
                    default_model: 'llama-3.3-70b-versatile',
                    last_tested_at: null,
                    last_status: 'unknown',
                    last_error: null
                },
                claude: {
                    name: 'Anthropic Claude',
                    api_key: process.env.ANTHROPIC_API_KEY || '',
                    api_base_url: 'https://api.anthropic.com/v1',
                    is_active: true,
                    default_model: 'claude-3-5-haiku-20241022',
                    last_tested_at: null,
                    last_status: 'unknown',
                    last_error: null
                },
                local_knowledge: {
                    name: 'SkinCheck Database Knowledge Engine (Fallback & Offline)',
                    api_key: '',
                    is_active: true,
                    default_model: 'local-knowledge-v1',
                    last_tested_at: new Date().toISOString(),
                    last_status: 'connected',
                    last_error: null
                }
            },
            models: [
                {
                    id: 'gemini-3.5-flash-lite',
                    name: 'Gemini 3.5 Flash Lite (Rekomendasi Utama & Respons Cepat)',
                    provider: 'gemini',
                    is_active: true,
                    is_default: true,
                    max_tokens: 1000,
                    temperature: 0.7,
                    timeout_ms: 10000,
                    retry_count: 2,
                    supports_vision: true,
                    description: 'Model multimodal generasi terbaru, sangat cepat dan efisien untuk konsultasi skincare dan rekomendasi produk.'
                },
                {
                    id: 'gemini-3.5-flash',
                    name: 'Gemini 3.5 Flash (Multimodal & Cerdas)',
                    provider: 'gemini',
                    is_active: true,
                    is_default: false,
                    max_tokens: 2048,
                    temperature: 0.7,
                    timeout_ms: 15000,
                    retry_count: 2,
                    supports_vision: true,
                    description: 'Model multimodal cerdas untuk penalaran mendalam dan analisis kondisi kulit kompleks.'
                },
                {
                    id: 'gpt-4o-mini',
                    name: 'GPT-4o Mini (OpenAI Cepat & Hemat)',
                    provider: 'openai',
                    is_active: true,
                    is_default: false,
                    max_tokens: 1000,
                    temperature: 0.7,
                    timeout_ms: 10000,
                    retry_count: 2,
                    supports_vision: true,
                    description: 'Model OpenAI ringan, sangat cepat, cerdas, dan efisien untuk percakapan konsumen.'
                },
                {
                    id: 'gpt-4o',
                    name: 'GPT-4o (OpenAI Flagship Multimodal)',
                    provider: 'openai',
                    is_active: true,
                    is_default: false,
                    max_tokens: 2048,
                    temperature: 0.7,
                    timeout_ms: 15000,
                    retry_count: 2,
                    supports_vision: true,
                    description: 'Model kecerdasan tertinggi OpenAI untuk penalaran klinis dan analisis multi-bahasa.'
                },
                {
                    id: 'llama-3.3-70b-versatile',
                    name: 'Llama 3.3 70B (Groq Ultra-Fast Inference)',
                    provider: 'custom_ai',
                    is_active: true,
                    is_default: false,
                    max_tokens: 1000,
                    temperature: 0.7,
                    timeout_ms: 8000,
                    retry_count: 2,
                    supports_vision: false,
                    description: 'Inference super cepat LPU melalui endpoint Groq / OpenAI-compatible.'
                },
                {
                    id: 'deepseek-chat',
                    name: 'DeepSeek-V3 / Chat (DeepSeek API)',
                    provider: 'custom_ai',
                    is_active: true,
                    is_default: false,
                    max_tokens: 1000,
                    temperature: 0.7,
                    timeout_ms: 12000,
                    retry_count: 2,
                    supports_vision: false,
                    description: 'Model penalaran hemat biaya tinggi melalui endpoint DeepSeek OpenAI-compatible.'
                },
                {
                    id: 'claude-3-5-haiku-20241022',
                    name: 'Claude 3.5 Haiku (Anthropic Fast)',
                    provider: 'claude',
                    is_active: true,
                    is_default: false,
                    max_tokens: 1000,
                    temperature: 0.7,
                    timeout_ms: 10000,
                    retry_count: 2,
                    supports_vision: false,
                    description: 'Model ringkas dan responsif dari Anthropic Claude.'
                },
                {
                    id: 'local-knowledge-v1',
                    name: 'Local Knowledge Engine (Offline Rule-Based)',
                    provider: 'local_knowledge',
                    is_active: true,
                    is_default: false,
                    max_tokens: 500,
                    temperature: 0.1,
                    timeout_ms: 1000,
                    retry_count: 0,
                    supports_vision: false,
                    description: 'Engine pencarian berbasis basis data produk dan knowledge base internal SkinCheck tanpa kuota API.'
                }
            ],
            assistant: {
                name: 'SkinCheck AI Assistant',
                language: 'id',
                communication_style: 'Ramah & Profesional',
                max_response_length: 150,
                is_active: true,
                system_instruction: 'Anda adalah SkinCheck AI Assistant, asisten edukasi perawatan kulit berbasis kecerdasan buatan. Bantu pengguna memahami kondisi kulit, rutinitas skincare, dan rekomendasi produk yang cocok. PENTING: Anda BUKAN dokter kulit dan DILARANG memberikan diagnosis medis pasti atas kelainan kulit atau meresepkan obat keras/antibiotik. Selalu sarankan konsultasi dokter spesialis untuk keluhan klinis serius.',
                fallback_message: 'Halo! Saya adalah asisten AI SkinCheck. Maaf, sistem sedang mengalami kendala teknis sementara. Namun, Anda tetap dapat menelusuri katalog produk rekomendasi kami.'
            }
        },
        whatsapp: {
            active_provider: (process.env.WHATSAPP_PROVIDER || 'fonnte').toLowerCase(),
            providers: {
                fonnte: {
                    name: 'Fonnte WhatsApp Gateway',
                    token: process.env.WHATSAPP_ACCESS_TOKEN || 'jaKJV6y9aP728wmuLJhp',
                    api_base_url: process.env.WHATSAPP_API_BASE_URL && process.env.WHATSAPP_API_BASE_URL.includes('fonnte')
                        ? process.env.WHATSAPP_API_BASE_URL
                        : 'https://api.fonnte.com/send',
                    last_tested_at: null,
                    last_status: 'unknown',
                    last_error: null
                },
                meta: {
                    name: 'Meta WhatsApp Cloud API (Official)',
                    access_token: process.env.WHATSAPP_ACCESS_TOKEN && !process.env.WHATSAPP_ACCESS_TOKEN.includes('jaK')
                        ? process.env.WHATSAPP_ACCESS_TOKEN
                        : '',
                    phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
                    business_account_id: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
                    api_base_url: 'https://graph.facebook.com/v21.0',
                    template_name: process.env.WHATSAPP_TEMPLATE_NAME || 'skincheck_verification',
                    template_lang: process.env.WHATSAPP_TEMPLATE_LANG || 'id',
                    last_tested_at: null,
                    last_status: 'unknown',
                    last_error: null
                },
                mock: {
                    name: 'Mock WhatsApp Provider (Testing/Dev)',
                    is_active: true,
                    last_tested_at: null,
                    last_status: 'connected',
                    last_error: null
                }
            },
            otp_settings: {
                expiration_seconds: parseInt(process.env.OTP_EXPIRATION_SECONDS || '300', 10),
                resend_cooldown_seconds: parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || '60', 10),
                max_attempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10),
                digit_length: 6,
                rate_limit_window_minutes: parseInt(process.env.OTP_RATE_LIMIT_WINDOW_MINUTES || '15', 10),
                rate_limit_max_per_phone: parseInt(process.env.OTP_RATE_LIMIT_MAX_PER_PHONE || '5', 10),
                rate_limit_max_per_ip: parseInt(process.env.OTP_RATE_LIMIT_MAX_PER_IP || '10', 10)
            },
            login_notification: {
                enabled: true,
                template: `Notifikasi Keamanan SkinCheck\n\nHalo, {name}!\n\nKami mendeteksi aktivitas login baru pada akun SkinCheck Anda.\n\nDetail aktivitas:\n- Waktu login: {time}\n- Perangkat: {device}\n- Browser: {browser}\n- Lokasi perkiraan: {location}\n\nJika ini adalah aktivitas Anda, tidak diperlukan tindakan lebih lanjut.\n\nJika Anda tidak merasa melakukan login tersebut, segera buka aplikasi SkinCheck dan amankan akun Anda dengan mengganti kata sandi atau menghubungi administrator.\n\nTerima kasih telah menggunakan SkinCheck.\n\n*Pesan otomatis dari sistem keamanan SkinCheck. Mohon tidak membalas pesan ini.*`,
                max_retries: 2
            }
        },
        updated_at: new Date().toISOString()
    };
}

let cachedConfig = null;

function loadConfig() {
    if (cachedConfig) return cachedConfig;

    if (!fs.existsSync(configFilePath)) {
        const initial = getDefaultConfig();
        saveConfig(initial);
        cachedConfig = initial;
        return initial;
    }

    try {
        const raw = fs.readFileSync(configFilePath, 'utf8');
        cachedConfig = JSON.parse(raw);

        // Ensure all models have valid name, provider, and metadata even if loaded from older/partial JSON
        if (cachedConfig && cachedConfig.ai && Array.isArray(cachedConfig.ai.models)) {
            const defaultModels = getDefaultConfig().ai.models;
            cachedConfig.ai.models = cachedConfig.ai.models.map(m => {
                const def = defaultModels.find(d => d.id === m.id) || {};
                return {
                    ...def,
                    ...m,
                    name: m.name || def.name || m.id,
                    provider: m.provider || def.provider || (m.id && m.id.startsWith('gemini') ? 'gemini' : 'local_knowledge'),
                    description: (m.description !== undefined && m.description !== '') ? m.description : (def.description || ''),
                    supports_vision: m.supports_vision !== undefined ? Boolean(m.supports_vision) : Boolean(def.supports_vision)
                };
            });
        }

        // Ensure login_notification is populated from defaults if missing
        if (cachedConfig && cachedConfig.whatsapp && !cachedConfig.whatsapp.login_notification) {
            cachedConfig.whatsapp.login_notification = getDefaultConfig().whatsapp.login_notification;
        }

        return cachedConfig;
    } catch (e) {
        console.error('[SystemConfig] Error reading system_config.json, returning defaults:', e.message);
        const defaults = getDefaultConfig();
        cachedConfig = defaults;
        return defaults;
    }
}

function saveConfig(config) {
    config.updated_at = new Date().toISOString();
    cachedConfig = config;
    try {
        fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error('[SystemConfig] Error writing system_config.json:', e.message);
        return false;
    }
}

class SystemConfigModel {
    /**
     * Get the full configuration object including secrets (FOR BACKEND USE ONLY)
     */
    getConfig() {
        return loadConfig();
    }

    /**
     * Get sanitized configuration object with masked credentials (SAFE FOR FRONTEND / API RESPONSES)
     */
    getSanitizedConfig() {
        const cfg = JSON.parse(JSON.stringify(this.getConfig()));

        // Mask AI secrets
        if (cfg.ai && cfg.ai.providers) {
            for (const key of Object.keys(cfg.ai.providers)) {
                const rawKey = cfg.ai.providers[key].api_key;
                cfg.ai.providers[key].api_key_masked = rawKey ? maskSecret(rawKey) : '';
                delete cfg.ai.providers[key].api_key;
            }
        }

        // Mask WhatsApp secrets
        if (cfg.whatsapp && cfg.whatsapp.providers) {
            if (cfg.whatsapp.providers.fonnte) {
                const rawFonnte = cfg.whatsapp.providers.fonnte.token;
                cfg.whatsapp.providers.fonnte.token_masked = rawFonnte ? maskSecret(rawFonnte) : '';
                delete cfg.whatsapp.providers.fonnte.token;
            }
            if (cfg.whatsapp.providers.meta) {
                const rawMeta = cfg.whatsapp.providers.meta.access_token;
                cfg.whatsapp.providers.meta.access_token_masked = rawMeta ? maskSecret(rawMeta) : '';
                delete cfg.whatsapp.providers.meta.access_token;
            }
        }

        return cfg;
    }

    getAiConfig() {
        return this.getConfig().ai;
    }

    getWhatsAppConfig() {
        return this.getConfig().whatsapp;
    }

    getOtpSettings() {
        return this.getConfig().whatsapp.otp_settings;
    }

    updateAiConfig({ active_provider, provider_settings, models, assistant }, user = null) {
        const cfg = this.getConfig();

        if (active_provider) {
            cfg.ai.active_provider = active_provider;
        }

        // Update provider settings (preserving existing API key if masked/blank)
        if (provider_settings) {
            for (const [pKey, pData] of Object.entries(provider_settings)) {
                if (!cfg.ai.providers[pKey]) {
                    cfg.ai.providers[pKey] = { name: pKey };
                }
                if (pData.name) cfg.ai.providers[pKey].name = pData.name;
                if (pData.is_active !== undefined) cfg.ai.providers[pKey].is_active = Boolean(pData.is_active);
                if (pData.default_model) cfg.ai.providers[pKey].default_model = pData.default_model;

                // Handle API key securely
                if (pData.api_key && !isMaskedValue(pData.api_key) && pData.api_key.trim() !== '') {
                    cfg.ai.providers[pKey].api_key = pData.api_key.trim();
                    if (pKey === 'gemini') process.env.AI_API_KEY = cfg.ai.providers[pKey].api_key;
                    if (pKey === 'openai') process.env.OPENAI_API_KEY = cfg.ai.providers[pKey].api_key;
                    if (pKey === 'custom_ai') process.env.CUSTOM_AI_API_KEY = cfg.ai.providers[pKey].api_key;
                    if (pKey === 'claude') process.env.ANTHROPIC_API_KEY = cfg.ai.providers[pKey].api_key;
                }
                if (pData.api_base_url && typeof pData.api_base_url === 'string' && pData.api_base_url.trim() !== '') {
                    cfg.ai.providers[pKey].api_base_url = pData.api_base_url.trim();
                }
            }
        }

        // Update models
        if (Array.isArray(models)) {
            const defaultModels = getDefaultConfig().ai.models;
            const existingModels = cfg.ai.models || [];
            cfg.ai.models = models.map(m => {
                const existing = existingModels.find(e => e.id === m.id) || defaultModels.find(d => d.id === m.id) || {};
                const provider = m.provider || existing.provider || (m.id && m.id.startsWith('gemini') ? 'gemini' : 'local_knowledge');
                const name = m.name || existing.name || m.id;
                const description = (m.description !== undefined && m.description !== '') ? m.description : (existing.description || '');
                const supports_vision = m.supports_vision !== undefined ? Boolean(m.supports_vision) : Boolean(existing.supports_vision);

                return {
                    id: m.id,
                    name,
                    provider,
                    is_active: m.is_active !== undefined ? Boolean(m.is_active) : (existing.is_active !== undefined ? Boolean(existing.is_active) : true),
                    is_default: Boolean(m.is_default),
                    max_tokens: parseInt(m.max_tokens || existing.max_tokens || '1000', 10),
                    temperature: parseFloat(m.temperature !== undefined ? m.temperature : (existing.temperature !== undefined ? existing.temperature : '0.7')),
                    timeout_ms: parseInt(m.timeout_ms || existing.timeout_ms || '10000', 10),
                    retry_count: parseInt(m.retry_count !== undefined ? m.retry_count : (existing.retry_count !== undefined ? existing.retry_count : '1'), 10),
                    supports_vision,
                    description
                };
            });
        }

        // Update assistant settings
        if (assistant) {
            if (assistant.name) cfg.ai.assistant.name = assistant.name.trim();
            if (assistant.language) cfg.ai.assistant.language = assistant.language;
            if (assistant.communication_style) cfg.ai.assistant.communication_style = assistant.communication_style;
            if (assistant.max_response_length) cfg.ai.assistant.max_response_length = parseInt(assistant.max_response_length, 10);
            if (assistant.is_active !== undefined) cfg.ai.assistant.is_active = Boolean(assistant.is_active);
            if (assistant.system_instruction) cfg.ai.assistant.system_instruction = assistant.system_instruction.trim();
            if (assistant.fallback_message) cfg.ai.assistant.fallback_message = assistant.fallback_message.trim();
        }

        saveConfig(cfg);

        auditLogModel.addLog({
            category: 'AI_CONFIG',
            action: `Konfigurasi AI diperbarui. Provider aktif: ${cfg.ai.active_provider}`,
            status: 'SUCCESS',
            details: {
                active_provider: cfg.ai.active_provider,
                assistant_name: cfg.ai.assistant.name
            },
            user
        });

        return this.getSanitizedConfig();
    }

    updateWhatsAppConfig({ active_provider, fonnte, meta, otp_settings, login_notification }, user = null) {
        const cfg = this.getConfig();

        if (active_provider) {
            cfg.whatsapp.active_provider = active_provider;
            process.env.WHATSAPP_PROVIDER = active_provider;
        }

        // Fonnte update (preserve token if masked or blank)
        if (fonnte) {
            if (fonnte.api_base_url) cfg.whatsapp.providers.fonnte.api_base_url = fonnte.api_base_url.trim();
            if (fonnte.token && !isMaskedValue(fonnte.token) && fonnte.token.trim() !== '') {
                cfg.whatsapp.providers.fonnte.token = fonnte.token.trim();
                process.env.WHATSAPP_ACCESS_TOKEN = cfg.whatsapp.providers.fonnte.token;
            }
        }

        // Meta update (preserve token if masked or blank)
        if (meta) {
            if (meta.phone_number_id !== undefined) cfg.whatsapp.providers.meta.phone_number_id = meta.phone_number_id.trim();
            if (meta.business_account_id !== undefined) cfg.whatsapp.providers.meta.business_account_id = meta.business_account_id.trim();
            if (meta.template_name !== undefined) cfg.whatsapp.providers.meta.template_name = meta.template_name.trim();
            if (meta.template_lang !== undefined) cfg.whatsapp.providers.meta.template_lang = meta.template_lang.trim();
            if (meta.access_token && !isMaskedValue(meta.access_token) && meta.access_token.trim() !== '') {
                cfg.whatsapp.providers.meta.access_token = meta.access_token.trim();
            }
        }

        // OTP settings update
        if (otp_settings) {
            if (otp_settings.expiration_seconds) cfg.whatsapp.otp_settings.expiration_seconds = parseInt(otp_settings.expiration_seconds, 10);
            if (otp_settings.resend_cooldown_seconds) cfg.whatsapp.otp_settings.resend_cooldown_seconds = parseInt(otp_settings.resend_cooldown_seconds, 10);
            if (otp_settings.max_attempts) cfg.whatsapp.otp_settings.max_attempts = parseInt(otp_settings.max_attempts, 10);
            if (otp_settings.rate_limit_window_minutes) cfg.whatsapp.otp_settings.rate_limit_window_minutes = parseInt(otp_settings.rate_limit_window_minutes, 10);
            if (otp_settings.rate_limit_max_per_phone) cfg.whatsapp.otp_settings.rate_limit_max_per_phone = parseInt(otp_settings.rate_limit_max_per_phone, 10);
            if (otp_settings.rate_limit_max_per_ip) cfg.whatsapp.otp_settings.rate_limit_max_per_ip = parseInt(otp_settings.rate_limit_max_per_ip, 10);
        }

        // Login notification settings update
        if (login_notification) {
            if (!cfg.whatsapp.login_notification) {
                cfg.whatsapp.login_notification = getDefaultConfig().whatsapp.login_notification;
            }
            if (login_notification.enabled !== undefined) {
                cfg.whatsapp.login_notification.enabled = Boolean(login_notification.enabled);
            }
            if (login_notification.template && typeof login_notification.template === 'string') {
                cfg.whatsapp.login_notification.template = login_notification.template.trim();
            }
            if (login_notification.max_retries !== undefined) {
                cfg.whatsapp.login_notification.max_retries = parseInt(login_notification.max_retries, 10);
            }
        }

        saveConfig(cfg);

        // Reset runtime WhatsApp provider cache
        try {
            const { resetProvider } = require('../services/whatsapp');
            resetProvider();
        } catch (e) {
            // ignore if not loaded yet
        }

        auditLogModel.addLog({
            category: 'WHATSAPP_CONFIG',
            action: `Konfigurasi WhatsApp OTP diperbarui. Provider aktif: ${cfg.whatsapp.active_provider}`,
            status: 'SUCCESS',
            details: {
                active_provider: cfg.whatsapp.active_provider,
                otp_expiration: cfg.whatsapp.otp_settings.expiration_seconds
            },
            user
        });

        return this.getSanitizedConfig();
    }

    recordTestResult(category, providerId, { status, error = null, responseTime = null }) {
        const cfg = this.getConfig();
        const now = new Date().toISOString();

        if (category === 'ai' && cfg.ai.providers[providerId]) {
            cfg.ai.providers[providerId].last_tested_at = now;
            cfg.ai.providers[providerId].last_status = status;
            cfg.ai.providers[providerId].last_error = error;
            if (responseTime) cfg.ai.providers[providerId].last_latency_ms = responseTime;
        } else if (category === 'whatsapp' && cfg.whatsapp.providers[providerId]) {
            cfg.whatsapp.providers[providerId].last_tested_at = now;
            cfg.whatsapp.providers[providerId].last_status = status;
            cfg.whatsapp.providers[providerId].last_error = error;
            if (responseTime) cfg.whatsapp.providers[providerId].last_latency_ms = responseTime;
        }

        saveConfig(cfg);
    }
}

module.exports = new SystemConfigModel();
