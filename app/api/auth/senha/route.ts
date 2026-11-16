// © Rayssa Paiva · Todos os direitos reservados
// Primeiro acesso: troca a senha provisória pela senha pessoal.
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { erro, json, senhaFraca, sessao } from '@/lib/auth';

export async function POST(req: Request) {
  const s = await sessao();
  if (!s) return erro('Sessão expirada. Entre de novo.', 401);
  const { senha } = await req.json().catch(() => ({}));
  const nova = String(senha ?? '');
  if (senhaFraca(nova)) return erro('Use pelo menos 8 caracteres, com letras e números.');
  const hash = await bcrypt.hash(nova, 10);
  const sql = db();
  if (s.papel === 'prof') await sql`update instrutores set senha_hash = ${hash}, primeiro = false where id = ${s.id}`;
  else await sql`update alunos set senha_hash = ${hash}, primeiro = false where id = ${s.id}`;
  return json({ ok: true });
}
