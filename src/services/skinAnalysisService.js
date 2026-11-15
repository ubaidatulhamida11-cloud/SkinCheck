/**
 * Skin Analysis Service (Integrated with MobileNetV2)
 * This service uses the trained TFJS model if available, otherwise falls back to mock logic.
 */
const fs = require('fs');
const path = require('path');
let tf;
let jpeg;

try {
    tf = require('@tensorflow/tfjs');
    jpeg = require('jpeg-js');
} catch (e) {
    console.warn("TensorFlow.js or jpeg-js not installed. Will fallback to mock logic.", e.message);
}

const classes = [
    "berjerawat",
    "berminyak",
    "dermatitis_perioral",
    "kering",
    "normal",
    "penuaan",
    "vitiligo"
];

let model = null;

async function loadModel() {
    if (!model && tf) {
        try {
            const modelPath = 'file://' + path.join(__dirname, '../../data/model/model.json');
            model = await tf.loadLayersModel(modelPath);
            console.log('SkinCheck AI model loaded successfully from:', modelPath);
        } catch (error) {
            console.log('Failed to load SkinCheck AI model. Make sure you placed model.json and .bin in data/model/');
            // Silently continue without model
        }
    }
    return model;
}

function preprocessImage(imageBuffer) {
    if (!tf || !jpeg) return null;
    
    // Decode JPEG
    const rawImageData = jpeg.decode(imageBuffer, { useTArray: true });
    
    // Extract RGB from RGBA buffer
    const numPixels = rawImageData.width * rawImageData.height;
    const values = new Int32Array(numPixels * 3);
    for (let i = 0; i < numPixels; i++) {
        values[i * 3 + 0] = rawImageData.data[i * 4 + 0]; // R
        values[i * 3 + 1] = rawImageData.data[i * 4 + 1]; // G
        values[i * 3 + 2] = rawImageData.data[i * 4 + 2]; // B
    }

    return tf.tidy(() => {
        let tensor = tf.tensor3d(values, [rawImageData.height, rawImageData.width, 3], 'int32');
        // Resize to 224x224
        tensor = tf.image.resizeBilinear(tensor, [224, 224]);
        // Normalize 0-1
        tensor = tensor.div(255.0);
        return tensor.expandDims(0);
    });
}

// Helper to generate a random score between min and max
function getRandomScore(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function analyzeSkin(scanId, imagePath) {
    const aiModel = await loadModel();

    let detectedClass = 'unknown';
    let confidence = 0;
    let predictionsArray = [];

    if (aiModel && fs.existsSync(imagePath)) {
        try {
            const imageBuffer = fs.readFileSync(imagePath);
            const inputTensor = preprocessImage(imageBuffer);
            
            if (inputTensor) {
                // Predict
                const prediction = aiModel.predict(inputTensor);
                const probabilities = await prediction.data();
                
                // Get highest probability
                const maxIdx = probabilities.indexOf(Math.max(...probabilities));
                detectedClass = classes[maxIdx];
                confidence = probabilities[maxIdx];
                
                tf.dispose([inputTensor, prediction]);
                
                predictionsArray = Array.from(probabilities).map((prob, i) => ({
                    className: classes[i],
                    probability: prob
                }));
            }
        } catch (err) {
            console.error("Prediction error:", err);
        }
    } else {
        // Simulate delay if no model loaded
        const delay = getRandomScore(2000, 4000);
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // Map the detected class to scores (100 = perfect skin condition)
    let acne_score = getRandomScore(70, 95);
    let redness_score = getRandomScore(70, 95);
    let texture_score = getRandomScore(70, 95);
    let hyperpigmentation_score = getRandomScore(70, 95);

    if (detectedClass === 'berjerawat') {
        acne_score = getRandomScore(20, 50);
        redness_score = getRandomScore(40, 60);
    } else if (detectedClass === 'kering') {
        texture_score = getRandomScore(30, 60);
    } else if (detectedClass === 'berminyak') {
        acne_score = getRandomScore(50, 70);
    } else if (detectedClass === 'penuaan') {
        texture_score = getRandomScore(40, 60);
        hyperpigmentation_score = getRandomScore(40, 60);
    } else if (detectedClass === 'dermatitis_perioral') {
        redness_score = getRandomScore(20, 40);
        acne_score = getRandomScore(40, 60);
    } else if (detectedClass === 'vitiligo') {
        hyperpigmentation_score = getRandomScore(20, 40);
    } else if (detectedClass === 'normal') {
        acne_score = getRandomScore(85, 100);
        redness_score = getRandomScore(85, 100);
        texture_score = getRandomScore(85, 100);
        hyperpigmentation_score = getRandomScore(85, 100);
    }

    const overall_score = Math.floor((acne_score + redness_score + texture_score + hyperpigmentation_score) / 4);

    return {
        acne_score,
        redness_score,
        texture_score,
        hyperpigmentation_score,
        overall_score,
        detected_condition: detectedClass !== 'unknown' ? detectedClass : null,
        confidence: detectedClass !== 'unknown' ? confidence : null,
        analysis_method: aiModel ? 'mobilenetv2_tfjs' : 'mock_cv_v1'
    };
}

module.exports = {
    analyzeSkin
};
