// © Rayssa Paiva · Todos os direitos reservados
// Verificação de saúde: mantém o servidor aquecido e o banco do Supabase ativo.
// Não devolve nenhum dado da plataforma.
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const t = Date.now();
  try {
    await db()`select 1`;
    return Response.json({ ok: true, ms: Date.now() - t }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
