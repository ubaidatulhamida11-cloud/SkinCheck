const safetyService = require('./safetyService');
const ragService = require('./ragService');
const userContextService = require('./userContextService');
const productRecommendationService = require('./productRecommendationService');
const llmProvider = require('./llmProviderService');
const aiModel = require('../../models/aiModel');

/**
 * AI Orchestrator
 * Coordinates the full AI pipeline:
 * User Input -> Safety -> Context & RAG -> LLM -> Output Safety -> Save
 */
async function processMessage(userId, conversationId, userMessage, contextType, contextId, currentUser = null) {
    // 1. Save user message
    const userMsg = aiModel.addMessage(conversationId, 'user', userMessage);

    // 2. Input Safety Check
    const inputValidation = safetyService.validateInput(userMessage);
    if (!inputValidation.isSafe) {
        const aiMsg = aiModel.addMessage(conversationId, 'ai', inputValidation.fallbackMessage, 'blocked_input');
        return { response: inputValidation.fallbackMessage, aiMessageId: aiMsg.id, userMessageId: userMsg.id };
    }

    // 3. Build Context (User Context + RAG)
    const userContext = userContextService.buildUserContext(userId, contextType, contextId);
    const ragContextDocs = await ragService.retrieveContext(userMessage);
    
    let ragContextString = "\n--- KNOWLEDGE BASE ---\n";
    ragContextDocs.forEach(doc => {
        ragContextString += `[${doc.title}]: ${doc.content}\n`;
    });
    
    // 3.5 Check if query is about products, and fetch candidates
    let productContextString = "";
    if (userMessage.toLowerCase().includes('produk') || userMessage.toLowerCase().includes('rekomendasi')) {
        const candidates = productRecommendationService.getCandidateProducts(userContext, userMessage);
        productContextString = "\n--- APPROVED PRODUCT CANDIDATES ---\n";
        candidates.forEach(p => {
            productContextString += `ID: ${p.id}, Brand: ${p.brand}, Name: ${p.name}, Category: ${p.category}, Ingredients: ${p.ingredients.join(', ')}\n`;
        });
        productContextString += "RULES: Only recommend products from this approved list. Do not invent products. Do not claim they cure diseases. Say 'Produk yang dapat dipertimbangkan'.\n";
    }
    
    const systemConfigModel = require('../../models/systemConfigModel');
    const databaseKnowledgeService = require('./databaseKnowledgeService');
    const assistantConfig = systemConfigModel.getAiConfig()?.assistant;
    const baseInstruction = assistantConfig?.system_instruction || "You are the SkinCheck AI Assistant. You do not provide medical diagnosis or prescriptions.";
    const brevityRule = "\n\nATURAN KHUSUS FORMAT JAWABAN:\n" +
        "1. Jawab HANYA apa yang ditanyakan saja secara persis tanpa mengait-ngaitkan data lain. Jika ditanya berapa banyak jumlah total pengguna, jawab HANYA jumlah total penggunanya saja (misalnya '7'). Jika ditanya berapa pengguna admin, jawab HANYA berapa banyak adminnya saja (misalnya '1'). Jika ditanya berapa customer, jawab HANYA berapa customernya saja (misalnya '6'). DILARANG KERAS menggabungkan data seperti 'Saat ini terdapat total 7 pengguna, terdiri dari 1 Administrator dan 6 Customer'. Cukup jawab apa yang ditanyakan!\n" +
        "2. HANYA jika pengguna menanyakan 'siapa' (atau meminta sebutkan/tuliskan rincian lengkap), barulah jawab secara LENGKAP dan DETAIL.\n" +
        "3. Dilarang keras menggunakan simbol asterisk (*).\n" +
        "4. Dilarang menjawab pertanyaan terkait coding/pemrograman.\n";
    
    let adminDbContext = "";
    if (currentUser && currentUser.role === 'admin') {
        adminDbContext = `\n\n--- DATABASE SYSTEM SNAPSHOT (ADMINISTRATOR ACCESS) ---\n${databaseKnowledgeService.getDatabaseSnapshot()}\nAnda memiliki hak akses penuh ke seluruh database untuk menjawab pertanyaan Administrator secara transparan.\n`;
    }

    const systemPrompt = `${baseInstruction}${brevityRule}\n\nUse the following context to help the user:\n${userContext}\n${ragContextString}${productContextString}${adminDbContext}`;

    // 4. Retrieve conversation history for LLM
    const history = aiModel.getMessagesByConversationId(conversationId).map(m => ({
        role: m.role,
        content: m.content
    }));

    // 5. Generate LLM Response
    const rawAiResponse = await llmProvider.generateResponse(systemPrompt, history, currentUser);

    // 6. Output Safety Check
    const outputValidation = safetyService.validateOutput(rawAiResponse);
    if (!outputValidation.isSafe) {
        const aiMsg = aiModel.addMessage(conversationId, 'ai', outputValidation.fallbackMessage, 'blocked_output');
        return { response: outputValidation.fallbackMessage, aiMessageId: aiMsg.id, userMessageId: userMsg.id };
    }

    // 7. Save and Return
    const aiMsg = aiModel.addMessage(conversationId, 'ai', rawAiResponse, 'safe');
    return { response: rawAiResponse, aiMessageId: aiMsg.id, userMessageId: userMsg.id };
}

module.exports = {
    processMessage
};
