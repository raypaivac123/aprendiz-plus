// © Rayssa Paiva · Todos os direitos reservados
import { db } from '@/lib/db';
import { erro, sessao } from '@/lib/auth';

// Só estes tipos abrem direto no navegador. Todo o resto (SVG, HTML etc.) é baixado,
// para que um arquivo enviado não consiga rodar código na sessão de quem o abre.
const INLINE = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp']);

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await sessao();
  if (!s) return erro('Entre na plataforma para abrir o arquivo.', 401);
  const { id } = await ctx.params;
  const sql = db();
  const [f] = await sql`select nome, mime, conteudo, instrutor_id, aluno_id from arquivos where id = ${id}`;
  if (!f) return erro('Arquivo não encontrado.', 404);
  if (f.aluno_id) {
    // arquivo de aprendiz: só a dona e o instrutor da turma dela
    if (s.papel === 'aluno' && f.aluno_id !== s.id) return erro('Sem permissão.', 403);
    if (s.papel === 'prof') {
      const [ok] = await sql`select 1 from alunos a join turmas t on t.id = a.turma_id where a.id = ${f.aluno_id} and t.instrutor_id = ${s.id}`;
      if (!ok) return erro('Sem permissão.', 403);
    }
  }
  const mime = String(f.mime).split(';')[0].trim().toLowerCase();
  const inline = INLINE.has(mime);
  return new Response(f.conteudo, {
    headers: {
      'Content-Type': inline ? mime : 'application/octet-stream',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.nome)}`,
      'Content-Security-Policy': inline && mime === 'application/pdf' ? "default-src 'none'; style-src 'unsafe-inline'; img-src data:" : "default-src 'none'; sandbox",
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=300',
    },
  });
}
