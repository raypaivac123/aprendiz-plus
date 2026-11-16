// © Rayssa Paiva · Todos os direitos reservados
// O instrutor cadastra ou troca o próprio e-mail (pede a senha atual).
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { erro, json, sessao } from '@/lib/auth';

export async function POST(req: Request) {
  const s = await sessao();
  if (!s || s.papel !== 'prof') return erro('Sessão expirada. Entre de novo.', 401);
  const { email, senha } = await req.json().catch(() => ({}));
  const e = String(email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) || e.length > 120) return erro('Digite um e-mail válido.');
  const sql = db();
  const [eu] = await sql`select senha_hash from instrutores where id = ${s.id}`;
  if (!eu?.senha_hash || !(await bcrypt.compare(String(senha ?? ''), eu.senha_hash))) return erro('Senha atual incorreta.', 400);
  const [x] = await sql`select 1 from instrutores where email = ${e} and id <> ${s.id}`;
  if (x) return erro('Este e-mail já está em uso por outro instrutor.');
  await sql`update instrutores set email = ${e} where id = ${s.id}`;
  return json({ ok: true });
}
