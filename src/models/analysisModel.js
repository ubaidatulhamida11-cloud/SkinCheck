const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, '../../data/analysis.json');

// Initialize file if it doesn't exist
if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify([]), 'utf8');
}

function getAnalysisRecords() {
    try {
        const data = fs.readFileSync(dataFile, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

function saveAnalysisRecords(records) {
    fs.writeFileSync(dataFile, JSON.stringify(records, null, 2), 'utf8');
}

module.exports = {
    createAnalysis(scanId, userId, results) {
        const records = getAnalysisRecords();
        
        const newAnalysis = {
            id: Date.now().toString(),
            skin_scan_id: scanId,
            user_id: userId,
            acne_score: results.acne_score,
            redness_score: results.redness_score,
            texture_score: results.texture_score,
            hyperpigmentation_score: results.hyperpigmentation_score,
            overall_score: results.overall_score,
            analysis_method: results.analysis_method,
            processing_status: 'completed',
            created_at: new Date().toISOString()
        };
        
        records.push(newAnalysis);
        saveAnalysisRecords(records);
        return newAnalysis;
    },
    
    getAnalysisByScanId(scanId) {
        const records = getAnalysisRecords();
        return records.find(a => a.skin_scan_id === scanId);
    },
    
    // Gets the previous analysis for a user, relative to a specific scan ID
    // Used for longitudinal tracking / comparison
    getPreviousAnalysis(userId, currentScanId) {
        const records = getAnalysisRecords()
            .filter(a => a.user_id === userId && a.processing_status === 'completed')
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            
        // Find the index of the current scan's analysis
        const currentIndex = records.findIndex(a => a.skin_scan_id === currentScanId);
        
        // The previous analysis is the one immediately after the current one in the descending sorted array
        if (currentIndex !== -1 && currentIndex + 1 < records.length) {
            return records[currentIndex + 1];
        }
        
        // If the current scan analysis isn't found (e.g. still processing)
        // Then the most recent completed analysis is the "previous" one relative to the pending one
        if (currentIndex === -1 && records.length > 0) {
            return records[0];
        }
        
        return null; // No previous scan
    },
    
    getAnalysesByUserId(userId) {
        const records = getAnalysisRecords();
        return records
            .filter(a => a.user_id === userId && a.processing_status === 'completed')
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },

    deleteAnalysisByScanId(scanId) {
        const records = getAnalysisRecords();
        const initialLength = records.length;
        const remainingRecords = records.filter(a => a.skin_scan_id !== scanId);
        
        if (remainingRecords.length !== initialLength) {
            saveAnalysisRecords(remainingRecords);
            return true;
        }
        return false;
    }
};
