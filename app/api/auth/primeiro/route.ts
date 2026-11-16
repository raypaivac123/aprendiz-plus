// © Rayssa Paiva · Todos os direitos reservados
// Primeira conta: enquanto não existe nenhum instrutor, o site mostra a tela
// "Criar a conta de administração". Depois da primeira conta, esta rota se fecha.
import bcrypt from 'bcryptjs';
import { db, garantirEsquema, novoId } from '@/lib/db';
import { criarSessao, erro, json, senhaFraca } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function semContas() {
  await garantirEsquema();
  const [r] = await db()`select count(*)::int as n from instrutores`;
  return r.n === 0;
}

export async function GET() {
  try {
    return json({ precisa: await semContas() });
  } catch {
    return erro('Não foi possível falar com o banco de dados.', 503);
  }
}

export async function POST(req: Request) {
  const { nome, usuario, email, senha } = await req.json().catch(() => ({}));
  const n = String(nome ?? '').trim();
  const u = String(usuario ?? '').trim().toLowerCase();
  const e = String(email ?? '').trim().toLowerCase() || null;
  const p = String(senha ?? '');
  if (!n || !u) return erro('Preencha nome e usuário.');
  if (!/^[a-z0-9._-]{3,40}$/.test(u)) return erro('Usuário: de 3 a 40 letras minúsculas, números, ponto, hífen ou sublinhado.');
  if (senhaFraca(p)) return erro('Use pelo menos 8 caracteres, com letras e números.');
  await garantirEsquema();

  const hash = await bcrypt.hash(p, 10);
  const id = novoId('i');
  const criada = await db().begin(async (sql) => {
    await sql`select pg_advisory_xact_lock(424242)`; // impede duas criações ao mesmo tempo
    const [r] = await sql`select count(*)::int as n from instrutores`;
    if (r.n > 0) return false;
    await sql`insert into instrutores (id, nome, usuario, email, senha_hash, admin, ativo, primeiro)
      values (${id}, ${n}, ${u}, ${e}, ${hash}, true, true, false)`;
    return true;
  });
  if (!criada) return erro('A conta de administração já foi criada. Entre com usuário e senha.', 409);
  await criarSessao('prof', id);
  return json({ ok: true });
}
