// © Rayssa Paiva · Todos os direitos reservados
import { encerrarSessao, json } from '@/lib/auth';

export async function POST() {
  await encerrarSessao();
  return json({ ok: true });
}
