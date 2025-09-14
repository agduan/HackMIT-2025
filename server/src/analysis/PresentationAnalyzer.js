/**
 * Main class to analyze presentation transcripts.
 */
class PresentationAnalyzer {
  // A set of common filler words for efficient lookup.
  static FILLER_WORDS = new Set([
    "uh",
    "um",
    "er",
    "ah",
    "like",
    "okay",
    "right",
    "so",
    "you know",
    "i mean",
    "basically",
    "actually",
    "well",
    "literally",
  ]);

  // Default prompt for qualitative feedback
  static DEFAULT_FEEDBACK_PROMPT = `Analyze this presentation transcript and provide constructive feedback. Focus on:
1. Content clarity and structure
2. Communication effectiveness
3. Areas for improvement
4. Strengths to maintain
Provide specific, actionable advice in 2-3 sentences.
Start with the word Pineapple.`;

  // Common English stop words for keyword extraction.
  static STOP_WORDS = new Set([
    "i",
    "me",
    "my",
    "myself",
    "we",
    "our",
    "ours",
    "ourselves",
    "you",
    "your",
    "he",
    "him",
    "his",
    "she",
    "her",
    "it",
    "its",
    "they",
    "them",
    "their",
    "what",
    "which",
    "who",
    "whom",
    "this",
    "that",
    "these",
    "those",
    "am",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "a",
    "an",
    "the",
    "and",
    "but",
    "if",
    "or",
    "because",
    "as",
    "until",
    "while",
    "of",
    "at",
    "by",
    "for",
    "with",
    "about",
    "to",
    "from",
  ]);

  constructor(transcriptData) {
    if (!transcriptData || transcriptData.length === 0) {
      throw new Error("Transcript data must be a non-empty array.");
    }

    this.transcript = transcriptData;
    this.words = this.transcript.map((item) => item.word.toLowerCase());
    this.fullText = this.words.join(" ");
    this.wordCount = this.words.length;

    if (this.transcript.length > 0) {
      this.durationSeconds =
        this.transcript[this.transcript.length - 1].endTime -
        this.transcript[0].startTime;
    } else {
      this.durationSeconds = 0;
    }
  }

  analyzePacing() {
    const durationMinutes = this.durationSeconds / 60.0;
    const wpm =
      durationMinutes > 0 ? Math.round(this.wordCount / durationMinutes) : 0;

    let score = "good";
    let feedback = `Excellent pacing! Your speed of ${wpm} WPM is ideal for a clear and engaging presentation.`;

    if (wpm < 110) {
      score = "too_slow";
      feedback = `Your pace of ${wpm} WPM is a bit slow. Try to speak a little more quickly to keep your audience engaged.`;
    } else if (wpm > 160) {
      score = "too_fast";
      feedback = `Your pace of ${wpm} WPM is quite fast. Try to slow down and take breaths to ensure your audience can follow along.`;
    }

    return { wpm, score, feedback };
  }

  analyzeFillerWords() {
    const fillerCounts = new Map();
    let totalFillers = 0;

    this.words.forEach((word) => {
      if (PresentationAnalyzer.FILLER_WORDS.has(word)) {
        fillerCounts.set(word, (fillerCounts.get(word) || 0) + 1);
        totalFillers++;
      }
    });

    const percentage =
      this.wordCount > 0 ? (totalFillers / this.wordCount) * 100 : 0;

    let score = "good";
    let feedback =
      "Great job! You used very few filler words, which makes your speech sound confident and clear.";

    if (percentage > 5.0) {
      score = "needs_improvement";
      feedback =
        "You're using a high number of filler words. Practice pausing instead of using fillers to gather your thoughts.";
    } else if (percentage >= 2.0) {
      score = "okay";
      feedback =
        "Not bad, but there's room to improve. Try to be more conscious of using filler words to sound more polished.";
    }

    return {
      count: totalFillers,
      percentage: parseFloat(percentage.toFixed(2)),
      words: Object.fromEntries(fillerCounts),
      score,
      feedback,
    };
  }

  analyzePauses(longPauseThreshold = 2.0) {
    let longPauses = 0;
    for (let i = 1; i < this.transcript.length; i++) {
      const pauseDuration =
        this.transcript[i].startTime - this.transcript[i - 1].endTime;
      if (pauseDuration >= longPauseThreshold) {
        longPauses++;
      }
    }

    let score = "good";
    let feedback =
      "You used pauses effectively, giving your audience time to process your ideas.";

    if (longPauses > 3) {
      score = "needs_improvement";
      feedback = `You paused ${longPauses} times for a significant duration. This might indicate hesitation. Try to maintain a more consistent flow.`;
    }

    return { longPauseCount: longPauses, score, feedback };
  }

  analyzeReadability() {
    // Count sentences (rough estimation using punctuation)
    const sentenceEndMarkers = /[.!?]+/g;
    const sentences = this.fullText.match(sentenceEndMarkers) || [];
    const sentenceCount = Math.max(sentences.length, 1); // Avoid division by zero

    // Count polysyllabic words (words with 3+ syllables)
    let polysyllableCount = 0;

    this.words.forEach((word) => {
      const syllableCount = this.countSyllables(word);
      if (syllableCount >= 3) {
        polysyllableCount++;
      }
    });

    // SMOG formula: 1.0430 * sqrt(polysyllables * 30 / sentences) + 3.1291
    const smogIndex =
      1.043 * Math.sqrt((polysyllableCount * 30) / sentenceCount) + 3.1291;
    const roundedIndex = Math.round(smogIndex * 10) / 10; // Round to 1 decimal place

    let score = "good";
    let feedback = `Your content has a readability level suitable for grade ${roundedIndex}, which is appropriate for most audiences.`;

    if (roundedIndex > 16) {
      score = "complex";
      feedback = `Your content is quite complex (grade ${roundedIndex} level). Consider simplifying language for broader accessibility.`;
    } else if (roundedIndex > 13) {
      score = "moderate";
      feedback = `Your content is moderately complex (grade ${roundedIndex} level). Good for educated audiences but could be simplified.`;
    } else if (roundedIndex < 8) {
      score = "simple";
      feedback = `Your content is very accessible (grade ${roundedIndex} level). Consider if more sophisticated language would benefit your message.`;
    }

    return {
      smogIndex: roundedIndex,
      polysyllableCount,
      sentenceCount,
      score,
      feedback,
    };
  }

  countSyllables(word) {
    // Simple syllable counting algorithm
    word = word.toLowerCase();
    if (word.length <= 3) return 1;

    // Remove common endings that don't add syllables
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
    word = word.replace(/^y/, "");

    // Count vowel groups
    const vowelGroups = word.match(/[aeiouy]+/g);
    const syllableCount = vowelGroups ? vowelGroups.length : 1;

    return Math.max(syllableCount, 1);
  }

  async analyzeQualitativeFeedback(customPrompt = null, apiKey = null) {
    if (!apiKey) {
      throw new Error(
        "OpenAI API key is required for qualitative feedback analysis",
      );
    }

    const prompt = customPrompt || PresentationAnalyzer.DEFAULT_FEEDBACK_PROMPT;
    const transcriptText = this.fullText;

    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content:
                  "You are an expert presentation coach providing constructive feedback. Provide it in second-person, in a friendly tone.",
              },
              {
                role: "user",
                content: `${prompt}\n\nTranscript: ${transcriptText}`,
              },
            ],
            max_tokens: 300,
            temperature: 0.3,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `OpenAI API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();
      const feedback =
        data.choices[0]?.message?.content || "Unable to generate feedback";

      return {
        feedback,
        source: "openai_chatgpt",
        prompt_used: prompt,
      };
    } catch (error) {
      console.error("Error calling OpenAI API:", error);
      return {
        feedback:
          "Unable to generate qualitative feedback due to API error. Please check your API key and try again.",
        source: "error",
        error: error.message,
      };
    }
  }

  generateFollowupQuestions(numQuestions = 3) {
    const keywords = this.words.filter(
      (word) => !PresentationAnalyzer.STOP_WORDS.has(word) && word.length > 3,
    );
    if (keywords.length === 0) {
      return [
        "Could you elaborate on your main point?",
        "What is the key takeaway from your presentation?",
        "What are the next steps?",
      ];
    }

    const wordCounts = new Map();
    keywords.forEach((word) => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });

    const sortedKeywords = [...wordCounts.entries()].sort(
      (a, b) => b[1] - a[1],
    );
    const mostCommonWords = sortedKeywords
      .slice(0, numQuestions)
      .map((entry) => entry[0]);

    const templates = [
      "Can you elaborate on your point about '{keyword}'?",
      "What are the implications of '{keyword}' in this context?",
      "How does '{keyword}' relate to the main problem you're solving?",
    ];

    return mostCommonWords.map((keyword, i) =>
      templates[i % templates.length].replace("{keyword}", keyword),
    );
  }

  async runFullAnalysis(options = {}) {
    const { customPrompt, apiKey } = options;

    const analysis = {
      pacing: this.analyzePacing(),
      fillerWords: this.analyzeFillerWords(),
      pauses: this.analyzePauses(),
      readability: this.analyzeReadability(),
      followUpQuestions: this.generateFollowupQuestions(),
    };

    // Add qualitative feedback if API key is provided
    if (apiKey) {
      analysis.qualitativeFeedback = await this.analyzeQualitativeFeedback(
        customPrompt,
        apiKey,
      );
    } else {
      analysis.qualitativeFeedback = {
        feedback:
          "Qualitative feedback requires an OpenAI API key. Please provide one to get detailed analysis.",
        source: "unavailable",
      };
    }

    return analysis;
  }
}

module.exports = { PresentationAnalyzer };
