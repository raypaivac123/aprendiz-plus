// © Rayssa Paiva · Todos os direitos reservados
import { db, type Sql } from './db';
import type { Sessao } from './auth';

export const TIPO_MAT: Record<string, string> = {
  aulas: 'aula', questionarios: 'questionario', dinamicas: 'dinamica', slides: 'slide', banco: 'banco', jogos: 'jogo',
};
const COL_MAT = Object.fromEntries(Object.entries(TIPO_MAT).map(([c, t]) => [t, c]));

type Row = Record<string, any>;
const turmaObj = (r: Row) => ({ ...r.dados, id: r.id, instrutor: r.instrutor_id });
const alunoObj = (r: Row) => ({ id: r.id, nome: r.nome, usuario: r.usuario, turma: r.turma_id, primeiro: r.primeiro, ativo: r.ativo, expira: r.expira, aprovado: r.aprovado, sobre: r.sobre || '', fotoV: r.fotov || null, pedidoEm: r.criado_em });
const matObj = (r: Row) => ({ ...r.dados, id: r.id, dono: r.dono_id });
const ativObj = (r: Row) => ({ ...r.dados, id: r.id, turma: r.turma_id });
const entObj = (r: Row) => ({ ...r.dados, id: r.id, at: r.atividade_id, aluno: r.aluno_id, status: r.status });
const avisoObj = (r: Row) => ({ ...r.dados, id: r.id, turma: r.turma_id });

function vazio() {
  return { vistasAt: [] as string[], vistasAv: [] as string[], instrutores: [] as Row[], turmas: [] as Row[], alunos: [] as Row[], aulas: [] as Row[], questionarios: [] as Row[], dinamicas: [] as Row[], slides: [] as Row[], banco: [] as Row[], atividades: [] as Row[], entregas: [] as Row[], jogos: [] as Row[], avisos: [] as Row[], lidos: [] as string[], vistas: [] as string[], duracao: 20 };
}

async function duracao(sql: Sql) {
  const [c] = await sql`select valor from config where chave = 'duracao'`;
  return Number(c?.valor) || 20;
}

/** Monta exatamente o que cada perfil pode ver. */
export async function carregar(s: Sessao) {
  const sql = db();
  const D = vazio();
  D.duracao = await duracao(sql);

  if (s.papel === 'prof') {
    await encerrarVencidas(s.id);
    D.instrutores = (await sql`select id, nome, usuario, email, admin, ativo, primeiro, coalesce(sobre, '') as sobre, substr(md5(foto), 1, 10) as "fotoV" from instrutores order by nome`).map((r) => ({ ...r }));
    if (!s.admin) D.instrutores = D.instrutores.map((i) => (i.id === s.id ? i : { id: i.id, nome: i.nome, usuario: i.usuario, admin: i.admin, ativo: i.ativo, primeiro: false, sobre: i.sobre, fotoV: i.fotoV }));
    D.turmas = (await sql`select t.*, c.token as convite from turmas t left join convites c on c.turma_id = t.id where t.instrutor_id = ${s.id} order by t.criado_em desc`).map((r) => ({ ...turmaObj(r), convite: r.convite || null }));
    const ids = D.turmas.map((t) => t.id);
    D.alunos = (await sql`select a.*, substr(md5(a.foto), 1, 10) as fotov from alunos a where turma_id = any(${ids}) order by nome`).map(alunoObj);
    for (const r of await sql`select * from materiais where dono_id = ${s.id} order by criado_em desc`) (D as any)[COL_MAT[r.tipo]].push(matObj(r));
    D.atividades = (await sql`select * from atividades where turma_id = any(${ids}) order by criado_em`).map(ativObj);
    D.entregas = (await sql`select e.* from entregas e join atividades a on a.id = e.atividade_id where a.turma_id = any(${ids})`).map(entObj);
    D.avisos = (await sql`select * from avisos where turma_id = any(${ids}) order by criado_em`).map(avisoObj);
    return D;
  }

  // aprendiz
  const tid = s.turma!;
  const [t] = await sql`select * from turmas where id = ${tid}`;
  D.turmas = t ? [turmaObj(t)] : [];
  D.instrutores = (await sql`select id, nome, coalesce(sobre, '') as sobre, substr(md5(foto), 1, 10) as "fotoV" from instrutores`).map((r) => ({ ...r, admin: false, ativo: true, primeiro: false }));
  D.alunos = (await sql`select a.*, substr(md5(a.foto), 1, 10) as fotov from alunos a where id = ${s.id}`).map(alunoObj);
  D.aulas = (await sql`select * from materiais where tipo = 'aula' and dados->'turmas' ? ${tid} order by criado_em desc`).map(matObj);
  D.atividades = (await sql`select * from atividades where turma_id = ${tid} order by criado_em`).map(ativObj);
  const refs = D.atividades.flatMap((a) => [a.banco, a.ref]).filter(Boolean);
  for (const r of await sql`select * from materiais where id = any(${refs}) and tipo in ('banco','questionario')`) (D as any)[COL_MAT[r.tipo]].push(matObj(r));
  D.entregas = (await sql`select * from entregas where aluno_id = ${s.id}`).map(entObj);
  D.avisos = (await sql`select * from avisos where turma_id = ${tid} order by criado_em`).map(avisoObj);
  for (const r of await sql`select tipo, ref_id from leituras where aluno_id = ${s.id}`) {
    if (r.tipo === 'aviso') D.lidos.push(r.ref_id);
    else if (r.tipo === 'aula') D.vistas.push(r.ref_id);
    else if (r.tipo === 'atividade') D.vistasAt.push(r.ref_id);
    else D.vistasAv.push(r.ref_id);
  }
  return D;
}

/** Mesmo cálculo do botão "Encerrar turma" do front-end. */
export async function gerarRelatorio(sql: Sql, turmaId: string) {
  const al = await sql`select id, nome from alunos where turma_id = ${turmaId} and aprovado order by nome`;
  const at = await sql`select id from atividades where turma_id = ${turmaId}`;
  const en = await sql`select e.aluno_id, e.status from entregas e join atividades a on a.id = e.atividade_id where a.turma_id = ${turmaId}`;
  const esperadas = al.length * at.length;
  const aval = en.filter((e) => e.status !== 'entregue');
  return {
    geradoEm: new Date(), alunos: al.length, atividades: at.length,
    pct: esperadas ? Math.round((en.length / esperadas) * 100) : 0,
    pctAt: aval.length ? Math.round((aval.filter((e) => e.status === 'atendido').length / aval.length) * 100) : null,
    jogos: 0,
    linhas: al.map((a) => { const es = en.filter((e) => e.aluno_id === a.id); return [a.nome, at.length, es.length, es.filter((e) => e.status === 'atendido').length, es.filter((e) => e.status === 'nao_atendido').length]; }),
  };
}

/** Fecha as turmas cujo prazo passou: gera o relatório e exclui as contas dos aprendizes. */
export async function encerrarVencidas(instrutorId?: string) {
  const sql = db();
  const vencidas = instrutorId
    ? await sql`select id from turmas where instrutor_id = ${instrutorId} and dados->>'fechada' is null and (dados->>'fecha')::timestamptz < now()`
    : await sql`select id from turmas where dados->>'fechada' is null and (dados->>'fecha')::timestamptz < now()`;
  for (const { id } of vencidas) {
    await sql.begin(async (tx) => {
      const rel = await gerarRelatorio(tx as unknown as Sql, id);
      await tx`update turmas set dados = dados || ${tx.json({ fechada: new Date().toISOString(), relatorio: JSON.parse(JSON.stringify(rel)) })} where id = ${id}`;
      await tx`delete from alunos where turma_id = ${id}`;
    });
  }
  // contas vencidas ou turmas já encerradas
  await sql`delete from alunos where expira < now() - interval '1 day'`;
  await sql`delete from jogo_sessoes where criado_em < now() - interval '1 day'`;
  return vencidas.length;
}
