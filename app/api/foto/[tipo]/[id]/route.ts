// © Rayssa Paiva · Todos os direitos reservados
// Entrega a foto de perfil, conferindo quem pode ver:
// instrutor → fotos dos instrutores e dos aprendizes das próprias turmas; aprendiz → a própria e as dos instrutores.
import { db } from '@/lib/db';
import { erro, sessao } from '@/lib/auth';

export async function GET(_req: Request, ctx: { params: Promise<{ tipo: string; id: string }> }) {
  const s = await sessao();
  if (!s) return erro('Entre na plataforma.', 401);
  const { tipo, id } = await ctx.params;
  const sql = db();
  let foto: string | null = null;
  if (tipo === 'i') {
    [{ foto } = { foto: null }] = await sql`select foto from instrutores where id = ${id}`;
  } else if (tipo === 'a') {
    if (s.papel === 'aluno' && id !== s.id) return erro('Sem permissão.', 403);
    const [r] = s.papel === 'aluno'
      ? await sql`select foto from alunos where id = ${id}`
      : await sql`select a.foto from alunos a join turmas t on t.id = a.turma_id where a.id = ${id} and t.instrutor_id = ${s.id}`;
    if (!r) return erro('Sem permissão.', 403);
    foto = r.foto;
  } else return erro('Não encontrado.', 404);
  const m = typeof foto === 'string' ? foto.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/) : null;
  if (!m) return erro('Sem foto.', 404);
  return new Response(Buffer.from(m[2], 'base64'), {
    headers: { 'Content-Type': m[1], 'Cache-Control': 'private, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" },
  });
}
