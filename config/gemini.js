const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-1.5-flash" });

/**
 * Sleep function for retry delays
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generate content using Gemini AI with retry logic
 * @param {string} prompt - The prompt to send to Gemini
 * @param {number} maxRetries - Maximum number of retries (default: 2)
 * @returns {Promise<string>} - The generated response
 */
async function generateContent(prompt, maxRetries = 2) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      return text;
    } catch (error) {
      lastError = error;
      console.error(`Error generating content from Gemini (attempt ${attempt + 1}/${maxRetries + 1}):`, error.message);
      
      // Check if it's a 503 (service unavailable) or 429 (rate limit) error
      if (error.status === 503 || error.status === 429) {
        if (attempt < maxRetries) {
          const delayMs = (attempt + 1) * 2000; // 2s, 4s, 6s...
          console.log(`Retrying in ${delayMs}ms...`);
          await sleep(delayMs);
          continue;
        }
      }
      
      // For other errors or if max retries reached, throw
      break;
    }
  }
  
  console.error("All retry attempts failed for Gemini API");
  throw new Error("Failed to generate AI response - service temporarily unavailable");
}

/**
 * Generate JSON content using Gemini AI
 * @param {string} prompt - The prompt to send to Gemini
 * @returns {Promise<Object>} - The parsed JSON response
 */
async function generateJSONContent(prompt) {
  try {
    const text = await generateContent(prompt);
    
    // Try to extract JSON from markdown code blocks if present
    let jsonText = text;
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }
    
    // Parse the JSON
    const parsed = JSON.parse(jsonText);
    return parsed;
  } catch (error) {
    console.error("Error parsing JSON from Gemini:", error);
    throw new Error("Failed to parse AI JSON response");
  }
}

module.exports = {
  genAI,
  model,
  generateContent,
  generateJSONContent,
};
