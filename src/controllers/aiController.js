const aiModel = require('../models/aiModel');
const aiOrchestrator = require('../services/ai/aiOrchestratorService');
const userModel = require('../models/userModel');
const databaseKnowledgeService = require('../services/ai/databaseKnowledgeService');

exports.getChatHistory = (req, res) => {
    const userId = req.session.user.id;
    const { contextType, contextId } = req.query;

    const conversation = aiModel.getConversation(userId, contextType, contextId);
    const messages = aiModel.getMessagesByConversationId(conversation.id);

    res.json({
        success: true,
        conversationId: conversation.id,
        messages: messages
    });
};

function cleanOutputText(text) {
    if (!text) return "";
    return text
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/\*/g, '')
        .trim();
}

exports.sendMessage = async (req, res) => {
    const userId = req.session.user.id;
    const { conversationId, message, contextType, contextId } = req.body;

    if (!message) {
        return res.status(400).json({ success: false, error: 'Message is required' });
    }

    // Verify conversation ownership
    const conversation = aiModel.getConversationById(conversationId);
    if (!conversation || conversation.user_id !== userId) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    try {
        const result = await aiOrchestrator.processMessage(
            userId, 
            conversationId, 
            message, 
            contextType, 
            contextId,
            req.session.user
        );

        const rawResponse = typeof result === 'object' ? result.response : result;
        const responseText = cleanOutputText(rawResponse);
        const aiMessageId = typeof result === 'object' ? result.aiMessageId : null;
        const userMessageId = typeof result === 'object' ? result.userMessageId : null;

        res.json({ 
            success: true, 
            response: responseText,
            aiMessageId,
            userMessageId
        });
    } catch (err) {
        console.error("AI Error:", err);
        res.status(500).json({ success: false, error: 'Failed to process message' });
    }
};

exports.clearChatHistory = (req, res) => {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    const { conversationId, contextType, contextId } = req.body;

    let targetConvId = conversationId;
    if (!targetConvId && userId) {
        const conversation = aiModel.getConversation(userId, contextType, contextId);
        targetConvId = conversation ? conversation.id : null;
    }

    if (targetConvId) {
        const conversation = aiModel.getConversationById(targetConvId);
        if (conversation && userId && conversation.user_id !== userId) {
            return res.status(403).json({ success: false, error: 'Forbidden' });
        }
        aiModel.clearConversationMessages(targetConvId);
    }

    res.json({ success: true, message: 'Riwayat percakapan berhasil dihapus' });
};

exports.deleteChatMessage = (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ success: false, error: 'Message ID is required' });
    }

    aiModel.deleteMessage(id);
    res.json({ success: true, message: 'Pesan berhasil dihapus' });
};

exports.sendWidgetMessage = async (req, res) => {
    const { message } = req.body;
    
    if (!message) {
        return res.status(400).json({ success: false, error: 'Message is required' });
    }

    try {
        const currentUser = req.session ? req.session.user : null;
        const userId = currentUser ? currentUser.id : 'guest';

        // 1. Get or create conversation for this customer
        const conversation = aiModel.getConversation(userId, 'widget', null);

        // 2. Save user message to database
        const userMsg = aiModel.addMessage(conversation.id, 'user', message, 'safe');

        // 3. Resolve AI response (real-time date & time, db facts, skincare guides, and LLM fallback)
        const rawResponse = await databaseKnowledgeService.resolveQuestion(message, currentUser);
        const cleanReply = databaseKnowledgeService.cleanText(rawResponse);

        // 4. Save AI response to database
        const aiMsg = aiModel.addMessage(conversation.id, 'ai', cleanReply, 'safe');

        res.json({ 
            success: true, 
            reply: cleanReply,
            conversationId: conversation.id,
            userMessageId: userMsg.id,
            aiMessageId: aiMsg.id
        });
    } catch (err) {
        console.error("General AI Error:", err);
        res.status(500).json({ success: false, error: 'Failed to process message' });
    }
};

