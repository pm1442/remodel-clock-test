const MAX_CONTEXT_CHARS = 24000;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Please sign in again before using the assistant.' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'The RidgePoint assistant is not set up yet. Add OPENAI_API_KEY in Vercel Project Settings → Environment Variables, then redeploy.' });

  try {
    const authResponse = await fetch(`${process.env.VITE_SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    });
    if (!authResponse.ok) return res.status(401).json({ error: 'Your sign-in session has expired. Please sign in again.' });

    const question = typeof req.body?.question === 'string' ? req.body.question.trim().slice(0, 1200) : '';
    if (!question) return res.status(400).json({ error: 'Ask a question first.' });
    const context = JSON.stringify(req.body?.context ?? {}).slice(0, MAX_CONTEXT_CHARS);
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5-mini',
        input: `You are the RidgePoint Remodeling internal assistant. Answer only from the RidgePoint data supplied below. Do not claim you searched the web. If the answer is not in the data, say so clearly. Be concise, practical, and friendly.\n\nRIDGEPOINT DATA:\n${context}\n\nQUESTION:\n${question}`,
      }),
    });
    const payload = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: payload?.error?.message ?? 'OpenAI could not answer right now.' });
    const answer = payload.output_text || payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === 'output_text')?.text;
    return res.status(200).json({ answer: answer || 'I could not find an answer in the RidgePoint information.' });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unexpected assistant error.' });
  }
}
