// © Rayssa Paiva · Todos os direitos reservados
// IA por uma API compatível com OpenAI (Groq por padrão, modelo GPT-OSS 120B; Ollama também funciona).
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
  // A Groq desligou os modelos Llama do plano gratuito em ago/2026; o substituto indicado é o gpt-oss-120b.
  const modelo = process.env.LLM_MODEL || 'openai/gpt-oss-120b';
  const raciocinio = modelo.includes('gpt-oss') ? { reasoning_effort: 'low' } : {};
  if (!chave) return erro('A IA ainda não foi configurada (LLM_API_KEY).', 503);

  let r: Response;
  try {
    r = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chave}` },
      body: JSON.stringify({
        model: modelo, stream: true, temperature: 0.7, max_tokens: 4096, ...raciocinio,
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
  if (!r.ok || !r.body) {
    // Mostra o motivo devolvido pelo provedor (nunca inclui a chave)
    const det = await r.text().catch(() => '');
    let msg = '';
    try { msg = JSON.parse(det)?.error?.message || ''; } catch { msg = det.slice(0, 200); }
    console.error('ia', r.status, msg);
    return erro(`Não foi possível usar a IA agora (provedor respondeu ${r.status}${msg ? ': ' + msg : ''}).`, 502);
  }

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
