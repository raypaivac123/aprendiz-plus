// © Rayssa Paiva · Todos os direitos reservados
// IA com Llama por uma API compatível com OpenAI (Groq por padrão; Ollama também funciona).
import { erro, sessao } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const s = await sessao();
  if (!s || s.papel !== 'prof') return erro('Só instrutores usam a IA.', 403);
  const { prompt } = await req.json().catch(() => ({}));
  const texto = String(prompt ?? '').slice(0, 8000);
  if (!texto.trim()) return erro('Pedido vazio.');

  const base = (process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/$/, '');
  const chave = process.env.LLM_API_KEY;
  const modelo = process.env.LLM_MODEL || 'llama-3.3-70b-versatile';
  if (!chave) return erro('A IA ainda não foi configurada (LLM_API_KEY).', 503);

  let r: Response;
  try {
    r = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chave}` },
      body: JSON.stringify({
        model: modelo, stream: true, temperature: 0.7, max_tokens: 2048,
        messages: [
          { role: 'system', content: 'Você é uma assistente pedagógica do Senac. Responda sempre em português do Brasil e siga exatamente o formato pedido.' },
          { role: 'user', content: texto },
        ],
      }),
    });
  } catch {
    return erro('Não foi possível falar com a IA agora.', 502);
  }
  if (r.status === 429) return erro('Muitos pedidos seguidos. Tente de novo em instantes.', 429);
  if (!r.ok || !r.body) return erro('Não foi possível usar a IA agora.', 502);

  // Converte o fluxo SSE do modelo em texto puro para o navegador
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  let resto = '';
  const fluxo = r.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, ctl) {
      resto += dec.decode(chunk, { stream: true });
      const linhas = resto.split('\n');
      resto = linhas.pop() ?? '';
      for (const l of linhas) {
        const d = l.trim();
        if (!d.startsWith('data:')) continue;
        const v = d.slice(5).trim();
        if (v === '[DONE]') continue;
        try { const t = JSON.parse(v).choices?.[0]?.delta?.content; if (t) ctl.enqueue(enc.encode(t)); } catch { /* pedaço incompleto */ }
      }
    },
  }));
  return new Response(fluxo, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}
