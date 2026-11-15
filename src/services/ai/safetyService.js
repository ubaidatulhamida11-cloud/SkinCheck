/**
 * Safety Service
 * Provides critical medical guardrails and coding-block policy for the AI Assistant.
 */

const HIGH_RISK_MEDICAL_KEYWORDS = [
    'kanker', 'tumor', 'infeksi parah', 'minta resep', 'resepkan obat', 'butuh resep', 
    'antibiotik', 'sakit parah', 'bengkak hebat', 'nanah', 'berdarah hebat', 'alergi parah'
];

const CODING_KEYWORDS = [
    'coding', 'koding', 'pemrograman', 'programan', 'bikin kode', 'buatkan kode',
    'tuliskan kode', 'script', 'source code', 'javascript', 'python', 'php',
    'html', 'css', 'sql', 'c++', 'c#', 'java ', ' java', 'react', 'nodejs',
    'node.js', 'vue', 'angular', 'syntax', 'framework', 'backend', 'frontend',
    'fullstack', 'database query', 'bikin fungsi', 'buat fungsi', 'membuat kode',
    'bikin aplikasi', 'buatkan program', 'buat program', 'algoritma'
];

function validateInput(userMessage) {
    if (!userMessage || typeof userMessage !== 'string') {
        return { isSafe: true };
    }
    const lowerMessage = userMessage.toLowerCase();
    
    // 1. Coding check policy: Bot DILARANG menjawab pertanyaan coding
    for (const keyword of CODING_KEYWORDS) {
        if (lowerMessage.includes(keyword)) {
            return {
                isSafe: false,
                reason: 'CODING_QUERY_BLOCKED',
                fallbackMessage: "Mohon maaf, saya tidak dapat menjawab pertanyaan atau permintaan terkait coding/pemrograman. Saya adalah asisten SkinCheck yang bertugas membantu pertanyaan umum seputar kesehatan kulit, rekomendasi skincare, dan seluruh data yang ada di dalam database aplikasi."
            };
        }
    }

    // 2. High risk medical emergency check
    for (const keyword of HIGH_RISK_MEDICAL_KEYWORDS) {
        if (lowerMessage.includes(keyword)) {
            return {
                isSafe: false,
                reason: 'HIGH_RISK_MEDICAL_KEYWORD',
                fallbackMessage: "Saya tidak dapat memastikan diagnosis medis untuk kondisi tersebut melalui chat. Jika kondisi menetap, memburuk, atau mengkhawatirkan, disarankan untuk berkonsultasi langsung dengan dokter kulit profesional. Saya adalah asisten AI edukasional SkinCheck dan bukan pengganti diagnosis medis langsung."
            };
        }
    }

    return {
        isSafe: true
    };
}

function validateOutput(aiMessage) {
    if (!aiMessage || typeof aiMessage !== 'string') {
        return { isSafe: true };
    }
    const lowerMessage = aiMessage.toLowerCase();
    if (lowerMessage.includes('saya mendiagnosis') || lowerMessage.includes('anda menderita')) {
         return {
             isSafe: false,
             fallbackMessage: "Maaf, respon sebelumnya diblokir karena berpotensi melanggar batasan medis. Harap berkonsultasi dengan dokter untuk diagnosis klinis yang tepat."
         };
    }
    return { isSafe: true };
}

module.exports = {
    validateInput,
    validateOutput
};
