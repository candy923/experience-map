import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const VENUS_URL = 'http://v2.open.venus.oa.com/llmproxy/chat/completions';
const PORT = Number(process.env.PORT || 8787);
const TOKEN_RAW = process.env.VENUS_TOKEN || '';
// Venus 网关要求 Bearer = AccessKeyID@1。允许 .env 里直接写带后缀的完整 token
// 也允许只写裸 ID，自动补 @1。
const TOKEN = TOKEN_RAW.includes('@') ? TOKEN_RAW : `${TOKEN_RAW}@1`;
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'qwen3.5-35b-a3b';

if (!TOKEN_RAW) {
  console.warn('[server] ⚠️  VENUS_TOKEN 未配置，/api/chat 会返回 500。请在 .env.local 中设置。');
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '4mb' }));

app.post('/api/chat', async (req, res) => {
  if (!TOKEN_RAW) {
    res.status(500).json({ error: 'VENUS_TOKEN not configured on server' });
    return;
  }

  const { messages, model = DEFAULT_MODEL, temperature, response_format } = req.body || {};
  if (!Array.isArray(messages)) {
    res.status(400).json({ error: 'messages must be an array' });
    return;
  }

  try {
    const upstream = await fetch(VENUS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ model, messages, temperature, response_format }),
    });
    const data = await upstream.json().catch(() => ({ error: 'Invalid JSON from upstream' }));
    res.status(upstream.status).json(data);
  } catch (err) {
    console.error('[server] /api/chat upstream error:', err);
    res.status(502).json({ error: 'Upstream request failed', detail: String(err) });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, hasToken: !!TOKEN_RAW });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] LLM proxy listening on http://0.0.0.0:${PORT}`);
  console.log(`[server] Health: http://localhost:${PORT}/api/health`);
});
