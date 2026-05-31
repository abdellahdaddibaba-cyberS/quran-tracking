/**
 * استدعاء نموذج لغوي (LLM) — OpenAI-compatible أو Google Gemini
 */

const DEFAULT_OPENAI_BASE = 'https://api.openai.com/v1';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';
const LLM_TIMEOUT_MS = 45000;

function extractJsonObject(text) {
  if (!text) return null;
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function isLlmConfigured() {
  return Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY);
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAICompatible(messages) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const baseUrl = (process.env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE).replace(/\/$/, '');
  const model = process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;

  const response = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? null;
}

async function callGemini(messages) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const system = messages.find((m) => m.role === 'system')?.content || '';
  const user = messages.find((m) => m.role === 'user')?.content || '';

  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${system}\n\n${user}` }] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

/**
 * @param {object} context - سياق الطالب والسجلات
 * @returns {Promise<object|null>}
 */
async function getLlmSuggestion(context) {
  if (!isLlmConfigured()) return null;

  const messages = [
    {
      role: 'system',
      content: [
        'أنت مستشار تربوي متخصص في تحفيظ القرآن الكريم.',
        'حلّل أداء الطالب واقترح قسطاً يومياً مناسباً (عدد الصفحات).',
        'أجب بJSON فقط بالحقول:',
        '{ "suggestedTarget": number, "status": "increase"|"decrease"|"keep", "recommendation": "نص عربي واضح للمعلم" }',
        'قواعد:',
        '- suggestedTarget عدد صحيح من 1 إلى 10',
        '- status = increase إذا الأداء ممتاز ومستقر، decrease إذا يتعثر، keep إذا الأداء مقبول',
        '- recommendation فقرة قصيرة بالعربية تشرح السبب وتذكر ملاحظات عملية',
      ].join('\n'),
    },
    {
      role: 'user',
      content: JSON.stringify(context, null, 2),
    },
  ];

  let raw;
  if (process.env.GEMINI_API_KEY) {
    raw = await callGemini(messages);
  } else {
    raw = await callOpenAICompatible(messages);
  }

  const parsed = extractJsonObject(raw);
  if (!parsed) {
    throw new Error('LLM returned invalid JSON');
  }

  return parsed;
}

module.exports = {
  isLlmConfigured,
  getLlmSuggestion,
};
