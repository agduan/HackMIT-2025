/**
 * Main class to analyze presentation transcripts.
 */
class PresentationAnalyzer {
    // A set of common filler words for efficient lookup.
    static FILLER_WORDS = new Set([
        'uh', 'um', 'er', 'ah', 'like', 'okay', 'right', 'so', 'you know',
        'i mean', 'basically', 'actually', 'well', 'literally'
    ]);

    // Sets for basic sentiment analysis.
    static POSITIVE_WORDS = new Set([
        'good', 'great', 'excellent', 'amazing', 'awesome', 'positive', 'success',
        'benefit', 'opportunity', 'achieve', 'effective', 'efficient', 'innovative'
    ]);
    static NEGATIVE_WORDS = new Set([
        'bad', 'problem', 'issue', 'challenge', 'difficult', 'failure', 'negative',
        'risk', 'poor', 'concern', 'limitation', 'inefficient'
    ]);
    
    // Common English stop words for keyword extraction.
    static STOP_WORDS = new Set([
        'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your',
        'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they', 'them', 'their',
        'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am',
        'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
        'do', 'does', 'did', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because',
        'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with', 'about', 'to', 'from'
    ]);

    constructor(transcriptData) {
        if (!transcriptData || transcriptData.length === 0) {
            throw new Error("Transcript data must be a non-empty array.");
        }

        this.transcript = transcriptData;
        this.words = this.transcript.map(item => item.word.toLowerCase());
        this.fullText = this.words.join(' ');
        this.wordCount = this.words.length;

        if (this.transcript.length > 0) {
            this.durationSeconds = this.transcript[this.transcript.length - 1].endTime - this.transcript[0].startTime;
        } else {
            this.durationSeconds = 0;
        }
    }

    analyzePacing() {
        const durationMinutes = this.durationSeconds / 60.0;
        const wpm = durationMinutes > 0 ? Math.round(this.wordCount / durationMinutes) : 0;

        let score = 'good';
        let feedback = `Excellent pacing! Your speed of ${wpm} WPM is ideal for a clear and engaging presentation.`;

        if (wpm < 110) {
            score = 'too_slow';
            feedback = `Your pace of ${wpm} WPM is a bit slow. Try to speak a little more quickly to keep your audience engaged.`;
        } else if (wpm > 160) {
            score = 'too_fast';
            feedback = `Your pace of ${wpm} WPM is quite fast. Try to slow down and take breaths to ensure your audience can follow along.`;
        }

        return { wpm, score, feedback };
    }
    
    analyzeFillerWords() {
        const fillerCounts = new Map();
        let totalFillers = 0;

        this.words.forEach(word => {
            if (PresentationAnalyzer.FILLER_WORDS.has(word)) {
                fillerCounts.set(word, (fillerCounts.get(word) || 0) + 1);
                totalFillers++;
            }
        });

        const percentage = this.wordCount > 0 ? (totalFillers / this.wordCount) * 100 : 0;
        
        let score = 'good';
        let feedback = "Great job! You used very few filler words, which makes your speech sound confident and clear.";

        if (percentage > 5.0) {
            score = 'needs_improvement';
            feedback = "You're using a high number of filler words. Practice pausing instead of using fillers to gather your thoughts.";
        } else if (percentage >= 2.0) {
            score = 'okay';
            feedback = "Not bad, but there's room to improve. Try to be more conscious of using filler words to sound more polished.";
        }
            
        return {
            count: totalFillers,
            percentage: parseFloat(percentage.toFixed(2)),
            words: Object.fromEntries(fillerCounts),
            score,
            feedback
        };
    }
    
    analyzePauses(longPauseThreshold = 2.0) {
        let longPauses = 0;
        for (let i = 1; i < this.transcript.length; i++) {
            const pauseDuration = this.transcript[i].startTime - this.transcript[i-1].endTime;
            if (pauseDuration >= longPauseThreshold) {
                longPauses++;
            }
        }
        
        let score = 'good';
        let feedback = "You used pauses effectively, giving your audience time to process your ideas.";

        if (longPauses > 3) {
            score = 'needs_improvement';
            feedback = `You paused ${longPauses} times for a significant duration. This might indicate hesitation. Try to maintain a more consistent flow.`;
        }

        return { longPauseCount: longPauses, score, feedback };
    }
    
    analyzeSentiment() {
        let posCount = 0;
        let negCount = 0;

        this.words.forEach(word => {
            if (PresentationAnalyzer.POSITIVE_WORDS.has(word)) posCount++;
            if (PresentationAnalyzer.NEGATIVE_WORDS.has(word)) negCount++;
        });
        
        const totalSentimentWords = posCount + negCount;
        let polarity = 0;
        let score = 'neutral';
        let feedback = "The tone of your presentation appears to be neutral.";

        if (totalSentimentWords > 0) {
            polarity = (posCount - negCount) / totalSentimentWords;
            if (polarity > 0.2) {
                score = 'positive';
                feedback = "The overall tone of your presentation is positive and optimistic.";
            } else if (polarity < -0.2) {
                score = 'negative';
                feedback = "The tone seems to focus on challenges or problems. Ensure you also highlight solutions and opportunities.";
            }
        }

        return { polarity: parseFloat(polarity.toFixed(2)), score, feedback };
    }
    
    generateFollowupQuestions(numQuestions = 3) {
        const keywords = this.words.filter(word => !PresentationAnalyzer.STOP_WORDS.has(word) && word.length > 3);
        if (keywords.length === 0) {
            return [
                "Could you elaborate on your main point?",
                "What is the key takeaway from your presentation?",
                "What are the next steps?"
            ];
        }

        const wordCounts = new Map();
        keywords.forEach(word => {
            wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
        });

        const sortedKeywords = [...wordCounts.entries()].sort((a, b) => b[1] - a[1]);
        const mostCommonWords = sortedKeywords.slice(0, numQuestions).map(entry => entry[0]);
        
        const templates = [
            "Can you elaborate on your point about '{keyword}'?",
            "What are the implications of '{keyword}' in this context?",
            "How does '{keyword}' relate to the main problem you're solving?"
        ];
        
        return mostCommonWords.map((keyword, i) => templates[i % templates.length].replace('{keyword}', keyword));
    }

    runFullAnalysis() {
        return {
            pacing: this.analyzePacing(),
            fillerWords: this.analyzeFillerWords(),
            pauses: this.analyzePauses(),
            sentiment: this.analyzeSentiment(),
            followUpQuestions: this.generateFollowupQuestions()
        };
    }
}

module.exports = { PresentationAnalyzer };
