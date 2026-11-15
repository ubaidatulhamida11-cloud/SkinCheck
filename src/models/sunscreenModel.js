const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, '../../data/sunscreen.json');

// Initialize file if it doesn't exist
if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify([]), 'utf8');
}

function getScans() {
    try {
        const data = fs.readFileSync(dataFile, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

function saveScans(scans) {
    fs.writeFileSync(dataFile, JSON.stringify(scans, null, 2), 'utf8');
}

module.exports = {
    createScan(userId, scanId, results) {
        const scans = getScans();
        
        const newScan = {
            id: Date.now().toString(),
            user_id: userId,
            skin_scan_id: scanId,
            coverage_score: results.coverage_score,
            coverage_status: results.coverage_status,
            heatmap_path: results.heatmap_path,
            low_coverage_areas: results.low_coverage_areas,
            analysis_method: results.analysis_method || 'rgb_visual_estimation',
            hardware_type: results.hardware_type || 'standard_rgb',
            created_at: new Date().toISOString()
        };
        
        scans.push(newScan);
        saveScans(scans);
        return newScan;
    },
    
    getScansByUserId(userId) {
        const scans = getScans();
        return scans.filter(s => s.user_id === userId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },
    
    getScanByScanId(scanId) {
        const scans = getScans();
        return scans.find(s => s.skin_scan_id === scanId);
    }
};
