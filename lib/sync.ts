// © Rayssa Paiva · Todos os direitos reservados
// Recebe as mudanças feitas na tela e grava no banco, conferindo a permissão de cada registro.
import bcrypt from 'bcryptjs';
import type { Sql } from './db';
import type { Sessao } from './auth';
import { TIPO_MAT } from './dados';

type Obj = Record<string, any>;
export type Lote = {
  upserts?: Record<string, Obj[]>;
  deletes?: Record<string, string[]>;
  lidos?: string[];
  vistas?: string[];
  vistasAt?: string[];
  vistasAv?: string[];
  config?: { duracao?: number } | null;
};
export class Proibido extends Error {}

const limpo = (o: Obj, tirar: string[] = []) => {
  const r: Obj = {};
  for (const [k, v] of Object.entries(o)) if (!k.startsWith('_') && !tirar.includes(k)) r[k] = v;
  return r;
};
const txt = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max);
const idOk = (v: unknown) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v);

async function usuarioLivre(tx: Sql, desejado: string, id: string) {
  let u = desejado.toLowerCase().replace(/[^a-z0-9._-]/g, '') || 'usuario';
  for (let n = 0; n < 50; n++) {
    const [x] = await tx`select 1 from instrutores where usuario = ${u} and id <> ${id}
      union all select 1 from alunos where usuario = ${u} and id <> ${id} limit 1`;
    if (!x) return u;
    u += '2';
  }
  throw new Error('Não foi possível gerar um usuário único.');
}

export async function aplicarLote(sql: Sql, s: Sessao, lote: Lote) {
  const up = lote.upserts ?? {};
  const del = lote.deletes ?? {};
  const renomeados: { col: string; id: string; usuario: string }[] = [];

  await sql.begin(async (t) => {
    const tx = t as unknown as Sql;

    if (s.papel === 'aluno') {
      const [turma] = await tx`select dados->>'fechada' as fechada from turmas where id = ${s.turma!}`;
      for (const o of up.entregas ?? []) {
        if (o.aluno !== s.id || !idOk(o.at)) throw new Proibido('Entrega inválida.');
        if (turma?.fechada) throw new Proibido('A turma já foi encerrada.');
        const [a] = await tx`select id from atividades where id = ${o.at} and turma_id = ${s.turma!}`;
        if (!a) throw new Proibido('Atividade não encontrada.');
        if (o.arquivoId) {
          const [f] = await tx`select 1 from arquivos where id = ${o.arquivoId} and aluno_id = ${s.id}`;
          if (!f) throw new Proibido('Arquivo inválido.');
        }
        const [ex] = await tx`select id, dados from entregas where atividade_id = ${o.at} and aluno_id = ${s.id}`;
        const dados = {
          texto: txt(o.texto, 20000), respostas: Array.isArray(o.respostas) ? o.respostas.map((r: unknown) => txt(r, 5000)) : null,
          arquivo: o.arquivo ? txt(o.arquivo) : null, arquivoId: o.arquivoId || null, quando: new Date().toISOString(), fb: ex?.dados?.fb ?? '',
        };
        if (ex) await tx`update entregas set status = 'entregue', dados = ${tx.json(dados)} where id = ${ex.id}`;
        else await tx`insert into entregas (id, atividade_id, aluno_id, status, dados) values (${idOk(o.id) ? o.id : crypto.randomUUID()}, ${o.at}, ${s.id}, 'entregue', ${tx.json(dados)})`;
      }
      for (const id of (lote.lidos ?? []).filter(idOk)) await tx`insert into leituras values (${s.id}, 'aviso', ${id}) on conflict do nothing`;
      for (const id of (lote.vistas ?? []).filter(idOk)) await tx`insert into leituras values (${s.id}, 'aula', ${id}) on conflict do nothing`;
      for (const id of (lote.vistasAt ?? []).filter(idOk)) await tx`insert into leituras values (${s.id}, 'atividade', ${id}) on conflict do nothing`;
      for (const id of (lote.vistasAv ?? []).filter(idOk)) await tx`insert into leituras values (${s.id}, 'avaliacao', ${id}) on conflict do nothing`;
      return;
    }

    // ---------- instrutor(a) ----------
    const eu = s.id;
    if (lote.config?.duracao && s.admin) {
      const d = Math.max(1, Math.min(120, Math.round(Number(lote.config.duracao))));
      await tx`insert into config values ('duracao', ${tx.json(d)}) on conflict (chave) do update set valor = excluded.valor`;
    }

    for (const o of up.instrutores ?? []) {
      if (!s.admin || !idOk(o.id)) continue; // só a administração cria e altera instrutores
      const usuario = await usuarioLivre(tx, txt(o.usuario, 60), o.id);
      if (usuario !== o.usuario) renomeados.push({ col: 'instrutores', id: o.id, usuario });
      const email = txt(o.email, 120).toLowerCase() || null;
      if (email) {
        const [x] = await tx`select 1 from instrutores where email = ${email} and id <> ${o.id}`;
        if (x) throw new Proibido('Já existe um instrutor com este e-mail.');
      }
      const hash = o._senha ? await bcrypt.hash(String(o._senha), 10) : null;
      const ativo = o.id === eu ? true : !!o.ativo; // ninguém se desativa sozinho
      const admin = o.id === eu ? true : !!o.admin;
      await tx`insert into instrutores (id, nome, usuario, email, senha_hash, admin, ativo, primeiro)
        values (${o.id}, ${txt(o.nome, 120)}, ${usuario}, ${email}, ${hash}, ${admin}, ${ativo}, ${!!o.primeiro})
        on conflict (id) do update set nome = excluded.nome, usuario = excluded.usuario, email = excluded.email, admin = excluded.admin,
          ativo = excluded.ativo, primeiro = excluded.primeiro, senha_hash = coalesce(excluded.senha_hash, instrutores.senha_hash)`;
    }

    for (const o of up.turmas ?? []) {
      if (!idOk(o.id)) continue;
      const dados = limpo(o, ['id', 'instrutor', 'convite']);
      const r = await tx`insert into turmas (id, instrutor_id, dados) values (${o.id}, ${eu}, ${tx.json(dados)})
        on conflict (id) do update set dados = excluded.dados where turmas.instrutor_id = ${eu} returning id`;
      if (!r.length) throw new Proibido('Turma de outro instrutor.');
    }
    const minhas = new Set((await tx`select id from turmas where instrutor_id = ${eu}`).map((r) => r.id as string));
    const minha = (id: unknown) => typeof id === 'string' && minhas.has(id);

    for (const [col, tipo] of Object.entries(TIPO_MAT)) {
      for (const o of up[col] ?? []) {
        if (!idOk(o.id)) continue;
        const dados = limpo(o, ['id', 'dono']);
        const r = await tx`insert into materiais (id, tipo, dono_id, dados) values (${o.id}, ${tipo}, ${eu}, ${tx.json(dados)})
          on conflict (id) do update set dados = excluded.dados where materiais.dono_id = ${eu} and materiais.tipo = ${tipo} returning id`;
        if (!r.length) throw new Proibido('Material de outro instrutor.');
      }
    }

    for (const o of up.alunos ?? []) {
      if (!idOk(o.id) || !minha(o.turma)) throw new Proibido('Aprendiz fora das suas turmas.');
      const [ex] = await tx`select turma_id from alunos where id = ${o.id}`;
      if (ex && !minhas.has(ex.turma_id)) throw new Proibido('Aprendiz de outro instrutor.');
      const usuario = await usuarioLivre(tx, txt(o.usuario, 60), o.id);
      if (usuario !== o.usuario) renomeados.push({ col: 'alunos', id: o.id, usuario });
      const hash = o._senha ? await bcrypt.hash(String(o._senha), 10) : null;
      await tx`insert into alunos (id, turma_id, nome, usuario, senha_hash, primeiro, ativo, expira, aprovado)
        values (${o.id}, ${o.turma}, ${txt(o.nome, 120)}, ${usuario}, ${hash}, ${!!o.primeiro}, ${o.ativo !== false}, ${o.expira ? new Date(o.expira) : null}, ${o.aprovado !== false})
        on conflict (id) do update set turma_id = excluded.turma_id, nome = excluded.nome, usuario = excluded.usuario, primeiro = excluded.primeiro,
          ativo = excluded.ativo, expira = excluded.expira, aprovado = excluded.aprovado, senha_hash = coalesce(excluded.senha_hash, alunos.senha_hash)`;
    }

    for (const o of up.atividades ?? []) {
      if (!idOk(o.id) || !minha(o.turma)) throw new Proibido('Atividade fora das suas turmas.');
      const r = await tx`insert into atividades (id, turma_id, dados) values (${o.id}, ${o.turma}, ${tx.json(limpo(o, ['id', 'turma']))})
        on conflict (id) do update set dados = excluded.dados, turma_id = excluded.turma_id
        where atividades.turma_id in (select id from turmas where instrutor_id = ${eu}) returning id`;
      if (!r.length) throw new Proibido('Atividade de outro instrutor.');
    }

    for (const o of up.avisos ?? []) {
      if (!idOk(o.id) || !minha(o.turma)) throw new Proibido('Recado fora das suas turmas.');
      const r = await tx`insert into avisos (id, turma_id, dados) values (${o.id}, ${o.turma}, ${tx.json(limpo(o, ['id', 'turma']))})
        on conflict (id) do update set dados = excluded.dados
        where avisos.turma_id in (select id from turmas where instrutor_id = ${eu}) returning id`;
      if (!r.length) throw new Proibido('Recado de outro instrutor.');
    }

    // correção: o instrutor só muda status e feedback
    for (const o of up.entregas ?? []) {
      if (!['entregue', 'atendido', 'nao_atendido'].includes(o.status)) continue;
      await tx`update entregas set status = ${o.status}, dados = dados || ${tx.json({ fb: txt(o.fb, 5000) })}
        where id = ${o.id} and atividade_id in (select a.id from atividades a join turmas t on t.id = a.turma_id where t.instrutor_id = ${eu})`;
    }

    // exclusões (filhos antes dos pais)
    const ids = (c: string) => (del[c] ?? []).filter(idOk);
    if (ids('entregas').length) await tx`delete from entregas where id = any(${ids('entregas')}) and atividade_id in (select a.id from atividades a join turmas t on t.id = a.turma_id where t.instrutor_id = ${eu})`;
    if (ids('avisos').length) await tx`delete from avisos where id = any(${ids('avisos')}) and turma_id in (select id from turmas where instrutor_id = ${eu})`;
    if (ids('atividades').length) await tx`delete from atividades where id = any(${ids('atividades')}) and turma_id in (select id from turmas where instrutor_id = ${eu})`;
    if (ids('alunos').length) await tx`delete from alunos where id = any(${ids('alunos')}) and turma_id in (select id from turmas where instrutor_id = ${eu})`;
    for (const col of Object.keys(TIPO_MAT)) if (ids(col).length) await tx`delete from materiais where id = any(${ids(col)}) and dono_id = ${eu}`;
    if (ids('turmas').length) await tx`delete from turmas where id = any(${ids('turmas')}) and instrutor_id = ${eu}`;
    if (s.admin && ids('instrutores').length) await tx`delete from instrutores where id = any(${ids('instrutores')}) and id <> ${eu}`;
  });

  return { renomeados };
}
