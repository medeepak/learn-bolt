
const OpenAI = require("openai");
// require('dotenv').config({ path: '.env.local' });

async function testOpenAI() {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    console.log("Testing OpenAI...");
    try {
        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: "Hello" }],
            model: "gpt-4o",
        });
        console.log("✅ OpenAI Success:", completion.choices[0].message.content);
    } catch (error) {
        console.log("❌ OpenAI Failed:", error.message);
    }
}

testOpenAI();
