
const { GoogleGenerativeAI } = require("@google/generative-ai");
// require('dotenv').config({ path: '.env.local' });

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
    // specific model query not available in checking, but we can try a simple generation
    // to verify a model name works.

    console.log("API Key loaded:", process.env.GOOGLE_AI_API_KEY ? "Yes (" + process.env.GOOGLE_AI_API_KEY.substring(0, 5) + "...)" : "No");

    const models = ['gemini-1.5-flash-latest', 'gemini-1.0-pro', 'gemini-pro-vision'];

    console.log("Testing models...");

    for (const modelName of models) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Hello");
            console.log(`✅ ${modelName}: Success`);
        } catch (error) {
            console.log(`❌ ${modelName}: Failed - ${error.message.split(']')[1] || error.message}`);
        }
    }
}

listModels();
