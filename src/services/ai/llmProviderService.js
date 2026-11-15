const { GoogleGenerativeAI } = require('@google/generative-ai');
const databaseKnowledgeService = require('./databaseKnowledgeService');
const systemConfigModel = require('../../models/systemConfigModel');

function cleanOutputText(text) {
    if (!text) return "";
    return text
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/\*/g, '')
        .trim();
}

const STYLE_INSTRUCTION = `
PERATURAN GAYA BAHASA: Tulislah jawaban dalam bahasa Indonesia yang matang, santun, dan profesional.
ATURAN KHUSUS & KRUSIAL:
1. JAWAB HANYA APA YANG DITANYAKAN. JANGAN menghubungkan atau menggabungkan kategori yang berbeda kecuali jika secara spesifik diminta.
2. Jika ditanyakan 'berapa banyak pengguna admin' atau 'berapa admin', jawab HANYA angka jumlah admin (contoh: 1). JANGAN sebutkan customer atau total pengguna.
3. Jika ditanyakan 'berapa customer' atau 'berapa banyak customer', jawab HANYA angka jumlah customer (contoh: 6). JANGAN sebutkan admin atau total pengguna.
4. Jika ditanyakan 'berapa banyak jumlah total pengguna' atau 'berapa total pengguna', jawab HANYA total penggunanya (contoh: 7). JANGAN gabungkan dengan rincian peran seperti 'terdiri dari X admin dan Y customer'.
5. Jika ditanyakan 'berapa', CUKUP JAWAB ANGKA SAJA tanpa perlu penjelasan panjang.
6. Jika ditanyakan 'siapa', barulah jawab secara LENGKAP dan DETAIL nama pengguna yang dimaksud.
7. JANGAN PERNAH menyertakan simbol asterisk (*) atau format markdown asterisks (**teks**). Sampaikan teks secara bersih tanpa tanda bintang.
`;

/**
 * Abstracted LLM Provider Service
 * Dynamically uses active AI configuration (Gemini, OpenAI, Custom AI, Claude, or Local Knowledge fallback).
 */
async function generateResponse(systemPrompt, messages, currentUser = null) {
    const aiConfig = systemConfigModel.getAiConfig();
    const activeProvider = aiConfig ? aiConfig.active_provider : 'gemini';

    if (activeProvider === 'gemini') {
        const geminiSettings = aiConfig?.providers?.gemini;
        const apiKey = (geminiSettings && geminiSettings.api_key) ? geminiSettings.api_key : process.env.AI_API_KEY;
        
        const defaultModelObj = (aiConfig?.models || []).find(m => m.is_default && m.provider === 'gemini') 
            || { id: 'gemini-3.5-flash-lite', temperature: 0.7, max_tokens: 1000 };

        if (apiKey && apiKey.trim() !== '') {
            try {
                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({ 
                    model: defaultModelObj.id,
                    generationConfig: {
                        temperature: defaultModelObj.temperature || 0.7,
                        maxOutputTokens: defaultModelObj.max_tokens || 1000
                    },
                    systemInstruction: systemPrompt + "\n" + STYLE_INSTRUCTION
                });

                const chatHistory = messages.slice(0, -1).map(msg => ({
                    role: msg.role === 'ai' ? 'model' : 'user',
                    parts: [{ text: msg.content }]
                }));

                const currentMessage = messages[messages.length - 1].content;

                const chat = model.startChat({
                    history: chatHistory
                });

                const result = await chat.sendMessage(currentMessage);
                return cleanOutputText(result.response.text());
            } catch (error) {
                console.error("Gemini API Error, falling back to database knowledge service:", error.message);
                return cleanOutputText(await getMockResponse(systemPrompt, messages, currentUser));
            }
        } else {
            return cleanOutputText(await getMockResponse(systemPrompt, messages, currentUser));
        }
    } else if (activeProvider === 'openai' || activeProvider === 'custom_ai') {
        const providerSettings = aiConfig?.providers?.[activeProvider];
        const apiKey = providerSettings?.api_key || (activeProvider === 'openai' ? process.env.OPENAI_API_KEY : process.env.CUSTOM_AI_API_KEY);
        const defaultBaseUrl = activeProvider === 'openai' ? 'https://api.openai.com/v1' : 'https://api.groq.com/openai/v1';
        const baseUrl = (providerSettings?.api_base_url || defaultBaseUrl).replace(/\/+$/, '');
        const defaultModel = activeProvider === 'openai' ? 'gpt-4o-mini' : 'llama-3.3-70b-versatile';
        const defaultModelObj = (aiConfig?.models || []).find(m => m.is_default && m.provider === activeProvider)
            || { id: defaultModel, temperature: 0.7, max_tokens: 1000 };

        if (apiKey && apiKey.trim() !== '') {
            try {
                const openAiMessages = [
                    { role: 'system', content: systemPrompt + "\n" + STYLE_INSTRUCTION },
                    ...messages.map(msg => ({
                        role: msg.role === 'ai' ? 'assistant' : 'user',
                        content: msg.content
                    }))
                ];

                const response = await fetch(`${baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey.trim()}`
                    },
                    body: JSON.stringify({
                        model: defaultModelObj.id,
                        messages: openAiMessages,
                        temperature: defaultModelObj.temperature ?? 0.7,
                        max_tokens: defaultModelObj.max_tokens ?? 1000
                    }),
                    signal: AbortSignal.timeout(15000)
                });

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errText}`);
                }

                const data = await response.json();
                const reply = data.choices?.[0]?.message?.content || "";
                return cleanOutputText(reply);
            } catch (error) {
                console.error(`[${activeProvider}] API Error, falling back to database knowledge service:`, error.message);
                return cleanOutputText(await getMockResponse(systemPrompt, messages, currentUser));
            }
        } else {
            return cleanOutputText(await getMockResponse(systemPrompt, messages, currentUser));
        }
    } else if (activeProvider === 'claude') {
        const claudeSettings = aiConfig?.providers?.claude;
        const apiKey = claudeSettings?.api_key || process.env.ANTHROPIC_API_KEY;
        const baseUrl = (claudeSettings?.api_base_url || 'https://api.anthropic.com/v1').replace(/\/+$/, '');
        const defaultModelObj = (aiConfig?.models || []).find(m => m.is_default && m.provider === 'claude')
            || { id: 'claude-3-5-haiku-20241022', temperature: 0.7, max_tokens: 1000 };

        if (apiKey && apiKey.trim() !== '') {
            try {
                const claudeMessages = messages.map(msg => ({
                    role: msg.role === 'ai' ? 'assistant' : 'user',
                    content: msg.content
                }));

                const response = await fetch(`${baseUrl}/messages`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey.trim(),
                        'anthropic-version': '2023-06-01'
                    },
                    body: JSON.stringify({
                        model: defaultModelObj.id,
                        system: systemPrompt + "\n" + STYLE_INSTRUCTION,
                        messages: claudeMessages,
                        temperature: defaultModelObj.temperature ?? 0.7,
                        max_tokens: defaultModelObj.max_tokens ?? 1000
                    }),
                    signal: AbortSignal.timeout(15000)
                });

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errText}`);
                }

                const data = await response.json();
                const reply = data.content?.[0]?.text || "";
                return cleanOutputText(reply);
            } catch (error) {
                console.error("[Claude] API Error, falling back to database knowledge service:", error.message);
                return cleanOutputText(await getMockResponse(systemPrompt, messages, currentUser));
            }
        } else {
            return cleanOutputText(await getMockResponse(systemPrompt, messages, currentUser));
        }
    } else {
        return cleanOutputText(await getMockResponse(systemPrompt, messages, currentUser));
    }
}

async function getMockResponse(systemPrompt, messages, currentUser = null) {
    // Small realistic delay for pleasant UX
    await new Promise(resolve => setTimeout(resolve, 400));

    if (!messages || messages.length === 0) {
        return "Halo! Saya adalah asisten AI SkinCheck. Ada yang bisa saya bantu seputar database aplikasi atau perawatan kulit?";
    }

    const lastMessage = messages[messages.length - 1].content;
    const response = databaseKnowledgeService.queryDatabase(lastMessage, currentUser);
    return cleanOutputText(response);
}

module.exports = {
    generateResponse
};
