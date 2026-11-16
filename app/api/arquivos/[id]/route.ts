// © Rayssa Paiva · Todos os direitos reservados
import { db } from '@/lib/db';
import { erro, sessao } from '@/lib/auth';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await sessao();
  if (!s) return erro('Entre na plataforma para abrir o arquivo.', 401);
  const { id } = await ctx.params;
  const [f] = await db()`select nome, mime, conteudo, instrutor_id, aluno_id from arquivos where id = ${id}`;
  if (!f) return erro('Arquivo não encontrado.', 404);
  // aprendiz só abre os próprios arquivos e os materiais dos instrutores
  if (s.papel === 'aluno' && f.aluno_id && f.aluno_id !== s.id) return erro('Sem permissão.', 403);
  const inline = /^(application\/pdf|image\/)/.test(f.mime);
  return new Response(f.conteudo, {
    headers: {
      'Content-Type': f.mime,
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.nome)}`,
      'Cache-Control': 'private, max-age=300',
    },
  });
}
