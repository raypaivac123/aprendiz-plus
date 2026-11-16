// © Rayssa Paiva · Todos os direitos reservados
// Rotina diária (Vercel Cron): encerra turmas vencidas e mantém o banco do Supabase ativo.
import { erro, json } from '@/lib/auth';
import { encerrarVencidas } from '@/lib/dados';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.get('authorization') !== `Bearer ${segredo}`) return erro('Não autorizado.', 401);
  const n = await encerrarVencidas();
  return json({ ok: true, turmasEncerradas: n });
}
