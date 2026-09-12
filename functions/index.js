const functions = require('firebase-functions');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

exports.assistant = functions.https.onRequest(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.set(corsHeaders);
    res.status(204).send('');
    return;
  }

  res.set(corsHeaders);

  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const body = req.body || {};
    const message = String(body.message || body.prompt || '').trim();
    if (!message) {
      res.status(400).json({ error: 'Missing message' });
      return;
    }

    const geminiKey = functions.config().gemini && functions.config().gemini.key
      ? functions.config().gemini.key
      : process.env.GEMINI_API_KEY;

    if (!geminiKey) {
      res.status(500).json({
        error: 'Gemini key is not configured on Firebase Functions.',
        text: 'The AI backend is not configured yet. Please add the key via Firebase config.'
      });
      return;
    }

    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const subject = String(body.subject || 'general');
    const pageTitle = String(body.pageTitle || 'HouseLearning page');
    const grade = String(body.grade || '');

    const prompt = [
      'You are the HouseLearning AI tutor. Keep answers short, friendly, kid-safe, and learning-focused.',
      `Student message: ${message}`,
      `Subject: ${subject}`,
      `Page title: ${pageTitle}`,
      grade ? `Grade: ${grade}` : '',
      'Answer clearly and helpfully with a brief explanation and one example when useful.'
    ].filter(Boolean).join('\n');

    const result = await model.generateContent(prompt);
    const text = await result.response.text();

    res.status(200).json({
      text: text.trim() || 'I am here to help you learn.',
      suggestions: []
    });
  } catch (error) {
    console.error('assistant function error', error);
    res.status(500).json({
      error: 'AI request failed',
      text: 'I could not reach the AI right now. Please try again in a moment.'
    });
  }
});
