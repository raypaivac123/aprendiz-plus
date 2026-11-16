// © Rayssa Paiva · Todos os direitos reservados
import { erro, json, sessao } from '@/lib/auth';
import { carregar } from '@/lib/dados';

export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await sessao();
  if (!s) return erro('Não autenticado.', 401);
  const D = await carregar(s);
  return json({ sessao: { papel: s.papel, id: s.id }, D });
}
