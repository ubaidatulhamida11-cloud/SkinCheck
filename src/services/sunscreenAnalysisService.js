/**
 * Sunscreen Analysis Service (Mock)
 * This service simulates an AI-based visual sunscreen coverage estimation.
 * Standard RGB cameras cannot detect UV directly, so this is purely a mock
 * visual estimation based on image tint/reflectivity or other heuristics.
 */

function getRandomScore(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function analyzeSunscreen(scanId, imagePath) {
    // Simulate AI processing delay
    const delay = getRandomScore(2000, 4000);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    const coverage_score = getRandomScore(40, 95);
    
    let coverage_status = "Perlu Perhatian";
    if (coverage_score > 85) {
        coverage_status = "Relatif Merata";
    } else if (coverage_score > 65) {
        coverage_status = "Cukup Merata";
    }

    const possibleAreas = [
        "hidung", "dahi", "pipi kanan", "pipi kiri", "dagu", "area sekitar mata"
    ];
    
    // Pick 1-2 random areas if score is low
    let low_coverage_areas = [];
    if (coverage_score <= 85) {
        const areaCount = getRandomScore(1, 2);
        for (let i = 0; i < areaCount; i++) {
            const area = possibleAreas[getRandomScore(0, possibleAreas.length - 1)];
            if (!low_coverage_areas.includes(area)) {
                low_coverage_areas.push(area);
            }
        }
    }

    return {
        coverage_score,
        coverage_status,
        low_coverage_areas,
        heatmap_path: null, // We'll handle heatmap visualization directly on the frontend using CSS for MVP
        analysis_method: 'rgb_visual_estimation',
        hardware_type: 'standard_rgb'
    };
}

module.exports = {
    analyzeSunscreen
};
