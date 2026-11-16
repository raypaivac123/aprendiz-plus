// © Rayssa Paiva · Todos os direitos reservados
import { db } from '@/lib/db';
import { erro, json, sessao } from '@/lib/auth';
import { aplicarLote, Proibido } from '@/lib/sync';

export async function POST(req: Request) {
  const s = await sessao();
  if (!s) return erro('Sessão expirada. Entre de novo.', 401);
  const lote = await req.json().catch(() => null);
  if (!lote || typeof lote !== 'object') return erro('Pedido inválido.');
  try {
    return json({ ok: true, ...(await aplicarLote(db(), s, lote)) });
  } catch (e) {
    if (e instanceof Proibido) return erro(e.message, 403);
    console.error('sync', e);
    return erro('Não foi possível salvar agora.', 500);
  }
}
