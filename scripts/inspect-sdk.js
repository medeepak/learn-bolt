
const { GoogleGenerativeAI } = require("@google/generative-ai");
console.log(Object.getOwnPropertyNames(GoogleGenerativeAI.prototype));
try {
    const genAI = new GoogleGenerativeAI("test");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(model)));
} catch (e) {
    console.log(e);
}
