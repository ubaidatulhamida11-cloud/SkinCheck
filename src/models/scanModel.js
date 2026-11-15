const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, '../../data/scans.json');

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
    createScan(userId, imagePath, metadata = {}) {
        const scans = getScans();
        
        const newScan = {
            id: Date.now().toString(),
            user_id: userId,
            image_path: imagePath, // Path relative to data/uploads
            status: metadata.status || 'captured', // pending, captured, processing, completed, failed
            image_quality_score: metadata.quality_score || null,
            metadata: {
                face_detected: metadata.face_detected || false,
                brightness: metadata.brightness || null,
            },
            timestamp: new Date().toISOString(),
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
    
    getScanById(id) {
        const scans = getScans();
        return scans.find(s => s.id === id);
    },
    
    updateScanStatus(id, status, additionalData = {}) {
        const scans = getScans();
        const index = scans.findIndex(s => s.id === id);
        if (index !== -1) {
            scans[index] = { 
                ...scans[index], 
                status,
                ...additionalData
            };
            saveScans(scans);
            return scans[index];
        }
        return null;
    },

    hardDeleteScansByUserId(userId) {
        const scans = getScans();
        const userScans = scans.filter(s => s.user_id === userId);
        
        // Delete actual image files
        userScans.forEach(scan => {
            const imagePath = path.join(__dirname, '../../data/uploads', scan.image_path);
            if (fs.existsSync(imagePath)) {
                try {
                    fs.unlinkSync(imagePath);
                } catch (e) {
                    console.error("Failed to delete image: ", imagePath);
                }
            }
        });

        // Keep scans that do NOT belong to this user
        const remainingScans = scans.filter(s => s.user_id !== userId);
        saveScans(remainingScans);
        return true;
    },

    deleteScanById(id, userId) {
        const scans = getScans();
        const index = scans.findIndex(s => s.id === id && s.user_id === userId);
        
        if (index !== -1) {
            const scan = scans[index];
            
            // Delete actual image file
            const imagePath = path.join(__dirname, '../../data/uploads', scan.image_path);
            if (fs.existsSync(imagePath)) {
                try {
                    fs.unlinkSync(imagePath);
                } catch (e) {
                    console.error("Failed to delete image: ", imagePath);
                }
            }
            
            scans.splice(index, 1);
            saveScans(scans);
            return true;
        }
        return false;
    }
};
