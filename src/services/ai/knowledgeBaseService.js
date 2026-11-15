const fs = require('fs');
const path = require('path');

const kbFile = path.join(__dirname, '../../../data/knowledge_base.json');

function getKnowledgeBase() {
    try {
        return JSON.parse(fs.readFileSync(kbFile, 'utf8'));
    } catch (e) {
        return [];
    }
}

module.exports = {
    getAllDocuments() {
        return getKnowledgeBase();
    }
};
