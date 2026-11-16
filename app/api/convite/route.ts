// © Rayssa Paiva · Todos os direitos reservados
// Link de convite da turma.
// GET  ?t=TOKEN  (público): diz de qual turma é o convite, se ainda vale.
// POST (instrutor): { turma, acao: 'gerar' | 'desativar' }.
import { randomBytes } from 'node:crypto';
import { db, garantirEsquema } from '@/lib/db';
import { erro, json, sessao } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get('t') || '';
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(t)) return erro('Convite inválido.', 404);
  await garantirEsquema();
  const [c] = await db()`select tu.dados->>'nome' as turma, tu.dados->>'fecha' as fecha, tu.dados->>'fechada' as fechada, i.nome as instrutor
    from convites c join turmas tu on tu.id = c.turma_id join instrutores i on i.id = c.instrutor_id where c.token = ${t}`;
  if (!c || c.fechada || (c.fecha && new Date(c.fecha) < new Date())) return erro('Este convite não vale mais. Peça um novo link à instrutora.', 404);
  return json({ turma: c.turma, instrutor: c.instrutor, fecha: c.fecha });
}

export async function POST(req: Request) {
  const s = await sessao();
  if (!s || s.papel !== 'prof') return erro('Sessão expirada. Entre de novo.', 401);
  const { turma, acao } = await req.json().catch(() => ({}));
  const sql = db();
  const [t] = await sql`select id, dados->>'fechada' as fechada from turmas where id = ${String(turma ?? '')} and instrutor_id = ${s.id}`;
  if (!t) return erro('Turma não encontrada.', 404);
  if (acao === 'desativar') {
    await sql`delete from convites where turma_id = ${t.id}`;
    return json({ ok: true, token: null });
  }
  if (acao !== 'gerar') return erro('Ação desconhecida.');
  if (t.fechada) return erro('Esta turma já foi encerrada.');
  const token = randomBytes(18).toString('base64url');
  await sql`insert into convites (token, turma_id, instrutor_id) values (${token}, ${t.id}, ${s.id})
    on conflict (turma_id) do update set token = excluded.token, criado_em = now()`;
  return json({ ok: true, token });
}
