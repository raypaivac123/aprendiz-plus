// © Rayssa Paiva · Todos os direitos reservados
// O aprendiz cria a própria conta pelo link da turma. A conta fica pendente até a instrutora aprovar.
import bcrypt from 'bcryptjs';
import { db, garantirEsquema, novoId } from '@/lib/db';
import { erro, json, senhaFraca } from '@/lib/auth';
import { fotoValida, textoSobre } from '@/lib/foto';

const MAX_PENDENTES = 200; // por turma

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const t = String(b.t ?? '');
  const nome = String(b.nome ?? '').replace(/\s+/g, ' ').trim();
  const usuario = String(b.usuario ?? '').trim().toLowerCase();
  const senha = String(b.senha ?? '');
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(t)) return erro('Convite inválido.', 404);
  if (nome.length < 5 || !nome.includes(' ') || nome.length > 120) return erro('Escreva seu nome completo.');
  if (!/^[a-z0-9._-]{3,40}$/.test(usuario)) return erro('Usuário: de 3 a 40 letras minúsculas, números, ponto, hífen ou sublinhado.');
  if (senhaFraca(senha)) return erro('Use pelo menos 8 caracteres, com letras e números.');
  const foto = b.foto ? fotoValida(b.foto) : null;
  if (b.foto && !foto) return erro('Não foi possível usar essa foto. Tente outra imagem.');
  await garantirEsquema();
  const sql = db();
  const [c] = await sql`select c.turma_id, tu.dados->>'fecha' as fecha, tu.dados->>'fechada' as fechada
    from convites c join turmas tu on tu.id = c.turma_id where c.token = ${t}`;
  if (!c || c.fechada || (c.fecha && new Date(c.fecha) < new Date())) return erro('Este convite não vale mais. Peça um novo link à instrutora.', 404);
  const [{ n }] = await sql`select count(*)::int as n from alunos where turma_id = ${c.turma_id} and not aprovado`;
  if (n >= MAX_PENDENTES) return erro('Há muitos pedidos esperando aprovação nesta turma. Tente mais tarde.', 429);
  const [usado] = await sql`select 1 from instrutores where usuario = ${usuario} union all select 1 from alunos where usuario = ${usuario} limit 1`;
  if (usado) return erro('Esse usuário já existe. Escolha outro (por exemplo, com um número no fim).', 409);
  const hash = await bcrypt.hash(senha, 10);
  await sql`insert into alunos (id, turma_id, nome, usuario, senha_hash, primeiro, ativo, expira, aprovado, foto, sobre)
    values (${novoId('a')}, ${c.turma_id}, ${nome.slice(0, 120)}, ${usuario}, ${hash}, false, true, ${c.fecha ? new Date(c.fecha) : null}, false, ${foto}, ${textoSobre(b.sobre)})`;
  return json({ ok: true });
}
