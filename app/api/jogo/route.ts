// © Rayssa Paiva · Todos os direitos reservados
// Quiz ao vivo: a tela do instrutor e os celulares consultam o estado a cada segundo.
import { db, type Sql } from '@/lib/db';
import { erro, json, sessao } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type Pergunta = { t: string; o: string[]; c: number; e?: string; tempo?: number };
const tempoDe = (q: Pergunta) => Math.max(5, Number(q.tempo) || 20);

function codigo() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => c[Math.floor(Math.random() * c.length)]).join('');
}

async function estado(sql: Sql, cod: string) {
  const [g] = await sql`select *, extract(epoch from (now() - inicio)) as passou from jogo_sessoes where codigo = ${cod}`;
  if (!g) return null;
  const perguntas: Pergunta[] = g.jogo.perguntas || [];
  const q = g.idx >= 0 ? perguntas[g.idx] : null;
  let restante = 0;
  if (q && g.fase === 'pergunta') {
    restante = Math.max(0, Math.ceil(tempoDe(q) - Number(g.passou)));
    const [{ n }] = await sql`select count(*)::int as n from jogo_jogadores where codigo = ${cod}`;
    const [{ r }] = await sql`select count(*)::int as r from jogo_respostas where codigo = ${cod} and idx = ${g.idx}`;
    if (restante <= 0 || (n > 0 && r >= n)) {
      await sql`update jogo_sessoes set fase = 'revelacao' where codigo = ${cod} and fase = 'pergunta' and idx = ${g.idx}`;
      g.fase = 'revelacao';
    }
  }
  return { g, perguntas, q, restante };
}

export async function GET(req: Request) {
  const s = await sessao();
  if (!s) return erro('Sessão expirada.', 401);
  const cod = new URL(req.url).searchParams.get('codigo')?.toUpperCase() || '';
  const sql = db();
  const e = await estado(sql, cod);
  if (!e) return erro('O jogo foi encerrado.', 404);
  const { g, perguntas, q, restante } = e;
  const jogadores = await sql`select aluno_id, nome, pontos from jogo_jogadores where codigo = ${cod} order by nome`;

  if (s.papel === 'prof') {
    if (g.instrutor_id !== s.id) return erro('Jogo de outro instrutor.', 403);
    const resp = g.idx >= 0 ? await sql`select j.nome, r.escolha from jogo_respostas r join jogo_jogadores j using (codigo, aluno_id) where r.codigo = ${cod} and r.idx = ${g.idx}` : [];
    return json({
      fase: g.fase, idx: g.idx, restante,
      jogadores: jogadores.map((j) => j.nome),
      pontos: Object.fromEntries(jogadores.map((j) => [j.nome, j.pontos])),
      respostas: Object.fromEntries(resp.map((r) => [r.nome, r.escolha])),
    });
  }

  const eu = jogadores.find((j) => j.aluno_id === s.id);
  if (!eu) return erro('Você não está neste jogo.', 403);
  const [minha] = g.idx >= 0 ? await sql`select escolha, pontos from jogo_respostas where codigo = ${cod} and aluno_id = ${s.id} and idx = ${g.idx}` : [];
  const ranking = [...jogadores].sort((a, b) => b.pontos - a.pontos);
  const aberta = g.fase === 'pergunta';
  return json({
    fase: g.fase === 'ranking' ? 'revelacao' : g.fase, idx: g.idx, total: perguntas.length, titulo: g.jogo.titulo, restante,
    pergunta: q ? (aberta ? { t: q.t, o: q.o, tempo: tempoDe(q) } : { t: q.t, o: q.o, c: q.c, e: q.e || '', tempo: tempoDe(q) }) : null,
    escolha: minha ? minha.escolha : null, ultimo: minha ? minha.pontos : 0, pontos: eu.pontos,
    posicao: ranking.findIndex((j) => j.aluno_id === s.id) + 1, totalJogadores: jogadores.length,
  });
}

export async function POST(req: Request) {
  const s = await sessao();
  if (!s) return erro('Sessão expirada.', 401);
  const b = await req.json().catch(() => ({}));
  const sql = db();
  const cod = String(b.codigo || '').trim().toUpperCase();

  if (s.papel === 'prof') {
    if (b.acao === 'criar') {
      const [m] = await sql`select dados from materiais where id = ${b.jogoId} and dono_id = ${s.id} and tipo = 'jogo'`;
      if (!m || !m.dados.perguntas?.length) return erro('Jogo sem perguntas.');
      await sql`delete from jogo_sessoes where instrutor_id = ${s.id}`;
      for (let n = 0; n < 10; n++) {
        const c = codigo();
        const r = await sql`insert into jogo_sessoes (codigo, instrutor_id, jogo) values (${c}, ${s.id}, ${sql.json({ titulo: m.dados.titulo, perguntas: m.dados.perguntas })}) on conflict do nothing returning codigo`;
        if (r.length) return json({ codigo: c });
      }
      return erro('Tente de novo.', 500);
    }
    const [g] = await sql`select * from jogo_sessoes where codigo = ${cod} and instrutor_id = ${s.id}`;
    if (!g) return erro('O jogo foi encerrado.', 404);
    if (b.acao === 'proxima') {
      if (g.idx + 1 >= (g.jogo.perguntas || []).length) await sql`update jogo_sessoes set fase = 'fim' where codigo = ${cod}`;
      else await sql`update jogo_sessoes set idx = idx + 1, fase = 'pergunta', inicio = now() where codigo = ${cod}`;
    } else if (b.acao === 'revelar') await sql`update jogo_sessoes set fase = 'revelacao' where codigo = ${cod}`;
    else if (b.acao === 'ranking') await sql`update jogo_sessoes set fase = 'ranking' where codigo = ${cod}`;
    else if (b.acao === 'fechar') await sql`delete from jogo_sessoes where codigo = ${cod}`;
    else return erro('Ação desconhecida.');
    return json({ ok: true });
  }

  // aprendiz
  if (b.acao === 'entrar') {
    const [g] = await sql`select fase from jogo_sessoes where codigo = ${cod}`;
    if (!g || g.fase === 'fim') return erro('Código não encontrado. Confira com o instrutor.', 404);
    await sql`insert into jogo_jogadores (codigo, aluno_id, nome) values (${cod}, ${s.id}, ${s.nome || 'Aprendiz'}) on conflict do nothing`;
    return json({ ok: true, codigo: cod });
  }
  if (b.acao === 'responder') {
    const e = await estado(sql, cod);
    if (!e || !e.q || e.g.fase !== 'pergunta') return json({ ok: false, ultimo: 0 });
    const k = Number(b.k);
    if (![0, 1, 2, 3].includes(k)) return erro('Alternativa inválida.');
    const pts = k === e.q.c ? Math.round(1000 * (0.5 + (0.5 * e.restante) / tempoDe(e.q))) : 0;
    const r = await sql`insert into jogo_respostas (codigo, aluno_id, idx, escolha, pontos)
      select ${cod}, ${s.id}, ${e.g.idx}, ${k}, ${pts} where exists (select 1 from jogo_jogadores where codigo = ${cod} and aluno_id = ${s.id})
      on conflict do nothing returning pontos`;
    if (r.length && pts) await sql`update jogo_jogadores set pontos = pontos + ${pts} where codigo = ${cod} and aluno_id = ${s.id}`;
    return json({ ok: !!r.length, ultimo: r.length ? pts : 0 });
  }
  return erro('Ação desconhecida.');
}
