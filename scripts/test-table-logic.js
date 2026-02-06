
function simpleTableLogic(dataStr) {
    try {
        let cleanStr = typeof dataStr === 'string' ? dataStr.trim() : JSON.stringify(dataStr)
        // Remove markdown code blocks if present
        if (cleanStr.startsWith('```')) {
            cleanStr = cleanStr.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '')
        }

        console.log("Attempting to parse:", cleanStr);
        const data = JSON.parse(cleanStr)

        if (!Array.isArray(data) || data.length === 0) {
            console.log("Parsed but not an array or empty");
            return null;
        }

        console.log("Success! Headers:", Object.keys(data[0]));
        return data;
    } catch (e) {
        console.error("Parse Error:", e.message);
        return null; // Simulate component returning error UI or null
    }
}

// Test Cases
const validJSON = '[{"Name": "Alice", "Role": "Dev"}]';
const markdownJSON = '```json\n[{"Name": "Bob", "Role": "Manager"}]\n```';
const invalidString = "An interactive map with highlighted zones representing different environments and stories.";

console.log("--- Test Case 1: Valid JSON ---");
simpleTableLogic(validJSON);

console.log("\n--- Test Case 2: Markdown JSON ---");
simpleTableLogic(markdownJSON);

console.log("\n--- Test Case 3: Invalid String (The Bug) ---");
simpleTableLogic(invalidString);
