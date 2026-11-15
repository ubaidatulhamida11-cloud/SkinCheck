const kbService = require('./knowledgeBaseService');

/**
 * RAG Service (Mock)
 * Simulates semantic search against the knowledge base.
 */
async function retrieveContext(query) {
    const docs = kbService.getAllDocuments();
    const lowerQuery = query.toLowerCase();
    
    // Simple keyword matching to simulate semantic search for MVP
    let relevantDocs = docs.filter(doc => {
        return lowerQuery.includes(doc.title.toLowerCase()) || 
               doc.content.toLowerCase().includes(lowerQuery.split(' ')[0]);
    });

    if (relevantDocs.length === 0 && docs.length > 0) {
        // Fallback: return top 1 doc just to have some context
        relevantDocs = [docs[0]];
    }

    return relevantDocs;
}

module.exports = {
    retrieveContext
};
