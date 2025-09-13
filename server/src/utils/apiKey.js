const fs = require("fs");
const path = require("path");

/**
 * Reads the OpenAI API key from the openai-key.txt file
 * @returns {string} The OpenAI API key
 */
function getOpenAIApiKey() {
  try {
    const keyFilePath = path.join(__dirname, "../../openai-key.txt");
    const apiKey = fs.readFileSync(keyFilePath, "utf8").trim();

    if (!apiKey || !apiKey.startsWith("sk-")) {
      throw new Error("Invalid OpenAI API key format");
    }

    return apiKey;
  } catch (error) {
    console.error("Error reading OpenAI API key:", error.message);
    throw new Error("Failed to load OpenAI API key from openai-key.txt file");
  }
}

module.exports = {
  getOpenAIApiKey,
};
