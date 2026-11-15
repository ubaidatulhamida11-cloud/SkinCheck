const config = require('../../config/env');
const MetaCloudApiProvider = require('./metaCloudProvider');
const FonnteWhatsAppProvider = require('./fonnteProvider');
const MockWhatsAppProvider = require('./mockProvider');

let activeProviderInstance = null;

function createProvider(providerName = null) {
    let waConfig = null;
    try {
        const systemConfigModel = require('../../models/systemConfigModel');
        waConfig = systemConfigModel.getWhatsAppConfig();
    } catch (e) {
        // fallback to env
    }

    const selected = (providerName || waConfig?.active_provider || config.WHATSAPP_PROVIDER || 'meta').toLowerCase();

    if (selected === 'mock') {
        return new MockWhatsAppProvider();
    }

    if (selected === 'fonnte') {
        const fonnteCfg = waConfig?.providers?.fonnte;
        return new FonnteWhatsAppProvider({
            token: fonnteCfg?.token || process.env.WHATSAPP_ACCESS_TOKEN || config.WHATSAPP_ACCESS_TOKEN,
            apiUrl: fonnteCfg?.api_base_url || (config.WHATSAPP_API_BASE_URL && config.WHATSAPP_API_BASE_URL.includes('fonnte') 
                ? config.WHATSAPP_API_BASE_URL 
                : 'https://api.fonnte.com/send')
        });
    }

    const metaCfg = waConfig?.providers?.meta;
    return new MetaCloudApiProvider({
        accessToken: metaCfg?.access_token || config.WHATSAPP_ACCESS_TOKEN,
        phoneNumberId: metaCfg?.phone_number_id || config.WHATSAPP_PHONE_NUMBER_ID,
        businessAccountId: metaCfg?.business_account_id || config.WHATSAPP_BUSINESS_ACCOUNT_ID,
        baseUrl: metaCfg?.api_base_url || config.WHATSAPP_API_BASE_URL,
        templateName: metaCfg?.template_name || config.WHATSAPP_TEMPLATE_NAME,
        templateLang: metaCfg?.template_lang || config.WHATSAPP_TEMPLATE_LANG
    });
}

function getProvider() {
    if (!activeProviderInstance) {
        activeProviderInstance = createProvider();
    }
    return activeProviderInstance;
}

function setProvider(providerInstance) {
    activeProviderInstance = providerInstance;
}

function resetProvider() {
    activeProviderInstance = createProvider();
}

module.exports = {
    getProvider,
    setProvider,
    resetProvider,
    createProvider,
    MetaCloudApiProvider,
    FonnteWhatsAppProvider,
    MockWhatsAppProvider
};
