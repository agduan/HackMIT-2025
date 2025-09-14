// analysis/FollowupGenerator.js
// Generates sharp, anchored follow-up questions from a transcript.

const DEFAULT_MODEL = "gpt-3.5-turbo"; // keep your existing model; upgrade later if you want

const MODE_PRESETS = {
  general: `Write a few probing, respectful questions that:
- Clarify assumptions/definitions/scope
- Pressure-test evidence, metrics, and tradeoffs
- Identify risks/unknowns/stakeholders
- Drive next steps and accountability
Keep each under 18 words. Limit to 5 questions at most.`,
  teaching: `Write a few learner-centered questions that:
- Elicit reasoning and misconceptions
- Connect concepts to examples and edge cases
- Scaffold reflection and self-explanation
Keep each under 18 words. Limit to 5 questions at most.`,
  interview: `Write a few interviewer-style questions that:
- Probe impact, decisions, constraints, and alternatives
- Ask for quantification and personal contribution
- Surface failure modes and next steps
Keep each under 18 words. Limit to 5 questions at most.`,
};

function chunkWindows(transcriptWords, windowSec = 20, maxChars = 500) {
  if (!Array.isArray(transcriptWords) || transcriptWords.length === 0) return [];
  const windows = [];
  let curStart = transcriptWords[0].startTime ?? 0;
  let curEnd = curStart + windowSec;
  let buf = [];

  const flush = () => {
    if (!buf.length) return;
    const text = buf.join(" ").slice(0, maxChars);
    windows.push({ start: curStart, end: curEnd, text });
    buf = [];
  };

  for (const w of transcriptWords) {
    const s = Number(w.startTime || 0);
    if (s < curEnd) buf.push(String(w.word || ""));
    else {
      flush();
      curStart = s;
      curEnd = curStart + windowSec;
      buf.push(String(w.word || ""));
    }
  }
  flush();
  return windows;
}

function extractJson(maybe) {
  if (!maybe) return null;
  // strip ```json fences if present
  const cleaned = String(maybe).replace(/```json|```/g, "").trim();
  try { return JSON.parse(cleaned); } catch { return null; }
}

async function callOpenAI({ apiKey, model, messages, temperature = 0.4, max_tokens = 800 }) {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens,
      response_format: { type: "json_object" }, // helps keep output valid JSON
    }),
  });
  if (!resp.ok) throw new Error(`OpenAI error: ${resp.status} ${resp.statusText}`);
  return resp.json();
}

/**
 * Generate follow-up questions.
 * @param {Array<{word:string,startTime:number,endTime:number}>|string} transcript
 * @param {{apiKey:string, analysisType?:'general'|'teaching'|'interview', total?:number, model?:string}} opts
 * @returns {Promise<{questions:string[], rich:Array, windows:Array}>}
 */
async function generateFollowups(transcript, opts) {
  const { apiKey, analysisType = "general", total = 6, model = DEFAULT_MODEL } = opts || {};
  if (!apiKey) throw new Error("OpenAI API key required");

  let windows = [];
  if (Array.isArray(transcript)) {
    windows = chunkWindows(transcript, 20, 500).slice(0, 60);
  } else if (typeof transcript === "string" && transcript.trim()) {
    // No timestamps: make a single window
    windows = [{ start: 0, end: Math.max(20, Math.ceil(transcript.split(/\s+/).length / 2)), text: transcript.slice(0, 4000) }];
  } else {
    return { questions: [], rich: [], windows: [] };
  }

  const preset = MODE_PRESETS[analysisType] || MODE_PRESETS.general;

  const system = `You are an expert presentation coach. Produce incisive follow-up questions grounded in the presenter's words.`;
  const schemaReminder = `Return ONLY JSON:
{
  "questions": [
    {
      "text": "string (the question)",
      "category": "clarify|evidence|scope|risk|next-steps|tradeoff|example",
      "difficulty": "easy|medium|hard",
      "why": "short rationale (optional)",
      "anchor": { "windowIndex": number, "start": number, "end": number }
    }, ...
  ]
}`;

  const prompt =
`You will receive the transcript in time windows.
Mode: "${analysisType}"
Target: ${total} questions.

Guidelines:
${preset}

Rules:
- Vary categories (include clarify, evidence, scope, risk, next-steps at minimum).
- Be specific; reference the claim/metric/decision you're probing.
- No generic filler or compliments.
- Keep each question under ~18 words.
- ${schemaReminder}

Windows (index, start→end seconds, text):
${windows.map((w, i) => `[${i}] ${w.start.toFixed(1)}→${w.end.toFixed(1)}s: ${w.text}`).join("\n")}
`;

  try {
    const data = await callOpenAI({
      apiKey,
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    });

    const raw = data.choices?.[0]?.message?.content || "";
    const parsed = extractJson(raw) || { questions: [] };
    const rich = Array.isArray(parsed.questions) ? parsed.questions : [];
    const questions = rich.map(q => q.text).filter(Boolean).slice(0, total);

    // basic dedupe
    const seen = new Set();
    const deduped = questions.filter(q => (q = q.trim()) && !seen.has(q.toLowerCase()) && seen.add(q.toLowerCase()));

    return { questions: deduped, rich, windows };
  } catch (err) {
    console.error("LLM follow-ups failed:", err);
    // fallback: simple generic set
    const fallback = [
      "What key assumption underlies your approach?",
      "Which risks could derail this plan?",
      "What evidence supports your main claim?",
      "How would this scale or fail at 10×?",
      "Whose perspective is missing here?",
      "What are your next measurable steps?"
    ].slice(0, total);
    return { questions: fallback, rich: [], windows };
  }
}

module.exports = { generateFollowups };