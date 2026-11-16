// © Rayssa Paiva · Todos os direitos reservados
import bcrypt from 'bcryptjs';
import { db, garantirEsquema } from '@/lib/db';
import { criarSessao, erro, json } from '@/lib/auth';

const espera = () => new Promise((r) => setTimeout(r, 400 + Math.random() * 400));
const LIMITE = 8;        // tentativas erradas seguidas
const BLOQUEIO = 15;     // minutos de espera depois do limite

export async function POST(req: Request) {
  const { usuario, senha } = await req.json().catch(() => ({}));
  const u = String(usuario ?? '').trim().toLowerCase();
  const p = String(senha ?? '');
  if (!u || !p) return erro('Preencha usuário e senha.');
  await garantirEsquema();
  const sql = db();

  const [tent] = await sql`select falhas, ate from tentativas_login where chave = ${u}`;
  if (tent?.ate && new Date(tent.ate) > new Date()) {
    return erro(`Muitas tentativas erradas. Espere ${BLOQUEIO} minutos ou peça uma nova senha ao instrutor.`, 429);
  }
  const falhou = async () => {
    await sql`insert into tentativas_login (chave, falhas) values (${u}, 1)
      on conflict (chave) do update set falhas = case when tentativas_login.ate is not null then 1 else tentativas_login.falhas + 1 end, ate = null`;
    await sql`update tentativas_login set ate = now() + ${BLOQUEIO + ' minutes'}::interval where chave = ${u} and falhas >= ${LIMITE}`;
    await espera();
    return erro('Usuário ou senha incorretos.', 401);
  };
  const acertou = () => sql`delete from tentativas_login where chave = ${u}`;

  const [ins] = await sql`select id, ativo, senha_hash from instrutores where usuario = ${u} or email = ${u}`;
  if (ins) {
    if (!ins.senha_hash || !(await bcrypt.compare(p, ins.senha_hash))) return falhou();
    await acertou();
    if (!ins.ativo) return erro('Esta conta de instrutor está desativada.', 403);
    await criarSessao('prof', ins.id);
    return json({ ok: true });
  }

  const [a] = await sql`select a.id, a.ativo, a.expira, a.senha_hash, t.dados->>'fechada' as fechada
    from alunos a join turmas t on t.id = a.turma_id where a.usuario = ${u}`;
  if (!a || !a.senha_hash || !(await bcrypt.compare(p, a.senha_hash))) return falhou();
  await acertou();
  if (!a.ativo || a.fechada || (a.expira && new Date(a.expira) < new Date())) return erro('Seu acesso terminou junto com a turma. Fale com o instrutor.', 403);
  await criarSessao('aluno', a.id);
  return json({ ok: true });
}
