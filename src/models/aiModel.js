const fs = require('fs');
const path = require('path');

const convFile = path.join(__dirname, '../../data/ai_conversations.json');
const msgFile = path.join(__dirname, '../../data/ai_messages.json');

function getConversations() {
    try {
        return JSON.parse(fs.readFileSync(convFile, 'utf8'));
    } catch (e) {
        return [];
    }
}

function getMessages() {
    try {
        return JSON.parse(fs.readFileSync(msgFile, 'utf8'));
    } catch (e) {
        return [];
    }
}

function saveConversations(data) {
    fs.writeFileSync(convFile, JSON.stringify(data, null, 2), 'utf8');
}

function saveMessages(data) {
    fs.writeFileSync(msgFile, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = {
    getConversation(userId, contextType = null, contextId = null) {
        const convs = getConversations();
        let conv = convs.find(c => 
            c.user_id === userId && 
            c.context_type === contextType && 
            c.context_id === contextId
        );

        if (!conv) {
            conv = {
                id: 'conv_' + Date.now().toString(),
                user_id: userId,
                context_type: contextType,
                context_id: contextId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            convs.push(conv);
            saveConversations(convs);
        }

        return conv;
    },
    
    getConversationById(convId) {
        return getConversations().find(c => c.id === convId);
    },

    getMessagesByConversationId(conversationId) {
        return getMessages().filter(m => m.conversation_id === conversationId);
    },

    addMessage(conversationId, role, content, safetyStatus = 'safe') {
        const msgs = getMessages();
        const newMsg = {
            id: 'msg_' + Date.now().toString() + Math.floor(Math.random()*1000),
            conversation_id: conversationId,
            role: role,
            content: content,
            safety_status: safetyStatus,
            created_at: new Date().toISOString()
        };
        msgs.push(newMsg);
        saveMessages(msgs);
        
        // Update conversation timestamp
        const convs = getConversations();
        const convIndex = convs.findIndex(c => c.id === conversationId);
        if (convIndex > -1) {
            convs[convIndex].updated_at = new Date().toISOString();
            saveConversations(convs);
        }

        return newMsg;
    },

    deleteMessage(messageId) {
        let msgs = getMessages();
        const initialLen = msgs.length;
        msgs = msgs.filter(m => m.id !== messageId);
        if (msgs.length !== initialLen) {
            saveMessages(msgs);
            return true;
        }
        return false;
    },

    clearConversationMessages(conversationId) {
        let msgs = getMessages();
        msgs = msgs.filter(m => m.conversation_id !== conversationId);
        saveMessages(msgs);
        return true;
    },

    deleteConversation(conversationId) {
        let convs = getConversations();
        const initialLen = convs.length;
        convs = convs.filter(c => c.id !== conversationId);
        if (convs.length !== initialLen) {
            saveConversations(convs);
        }
        this.clearConversationMessages(conversationId);
        return true;
    },

    getTotalMessagesCount() {
        return getMessages().length;
    },

    getCustomerChatSummaryList() {
        const convs = getConversations();
        const msgs = getMessages();
        const userModel = require('./userModel');
        const allUsers = userModel.getAllUsers();

        const summaryList = [];

        convs.forEach(c => {
            const conversationMessages = msgs
                .filter(m => m.conversation_id === c.id)
                .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

            if (conversationMessages.length > 0) {
                // Find matching user
                const user = allUsers.find(u => u.id === c.user_id);
                const lastUserMessage = conversationMessages.slice().reverse().find(m => m.role === 'user') || null;
                const lastAiMessage = conversationMessages.slice().reverse().find(m => m.role === 'ai') || null;
                const lastMsg = conversationMessages[conversationMessages.length - 1];

                summaryList.push({
                    conversationId: c.id,
                    userId: c.user_id,
                    user: user ? {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        role: user.role || 'customer',
                        phoneNumber: user.phone_number || null,
                        phoneVerified: Boolean(user.phone_verified)
                    } : {
                        id: c.user_id,
                        name: c.user_id === 'guest' ? 'Pengunjung (Guest)' : `Pengguna #${c.user_id}`,
                        email: '-',
                        role: 'customer',
                        phoneNumber: null,
                        phoneVerified: false
                    },
                    contextType: c.context_type || 'widget',
                    channelLabel: c.context_type === 'widget' ? 'Widget Popup' : 'Halaman Asisten AI',
                    totalMessages: conversationMessages.length,
                    userMessagesCount: conversationMessages.filter(m => m.role === 'user').length,
                    aiMessagesCount: conversationMessages.filter(m => m.role === 'ai').length,
                    lastUserMessage,
                    lastAiMessage,
                    lastMessage: lastMsg,
                    startedAt: conversationMessages[0].created_at || c.created_at,
                    updatedAt: lastMsg.created_at || c.updated_at || c.created_at
                });
            }
        });

        // Sort descending by latest interaction
        summaryList.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        return summaryList;
    },

    getConversationDetail(conversationId) {
        const convs = getConversations();
        const c = convs.find(item => item.id === conversationId);
        if (!c) return null;

        const msgs = getMessages()
            .filter(m => m.conversation_id === conversationId)
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        const userModel = require('./userModel');
        const user = userModel.getUserById(c.user_id);

        return {
            conversationId: c.id,
            userId: c.user_id,
            contextType: c.context_type || 'widget',
            channelLabel: c.context_type === 'widget' ? 'Widget Popup' : 'Halaman Asisten AI',
            user: user ? {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role || 'customer',
                phoneNumber: user.phone_number || null,
                phoneVerified: Boolean(user.phone_verified)
            } : {
                id: c.user_id,
                name: c.user_id === 'guest' ? 'Pengunjung (Guest)' : `Pengguna #${c.user_id}`,
                email: '-',
                role: 'customer'
            },
            startedAt: msgs.length > 0 ? msgs[0].created_at : c.created_at,
            updatedAt: msgs.length > 0 ? msgs[msgs.length - 1].created_at : (c.updated_at || c.created_at),
            totalMessages: msgs.length,
            messages: msgs.map(m => {
                const dateObj = new Date(m.created_at);
                const timeStr = !isNaN(dateObj.getTime()) ? 
                    `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}` : 
                    '-';
                const dateStr = !isNaN(dateObj.getTime()) ? 
                    dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 
                    '-';
                return {
                    id: m.id,
                    role: m.role,
                    content: m.content,
                    created_at: m.created_at,
                    formattedTime: timeStr,
                    formattedDate: dateStr
                };
            })
        };
    }
};
