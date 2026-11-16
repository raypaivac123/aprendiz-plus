// © Rayssa Paiva · Todos os direitos reservados
// Envio de arquivo: corpo bruto + cabeçalho x-nome. Limite de 4 MB (limite das funções da Vercel).
import { db, novoId } from '@/lib/db';
import { erro, json, sessao } from '@/lib/auth';

const MAX = 4 * 1024 * 1024;

export async function POST(req: Request) {
  const s = await sessao();
  if (!s) return erro('Sessão expirada. Entre de novo.', 401);
  const nome = decodeURIComponent(req.headers.get('x-nome') || 'arquivo').replace(/[\r\n"\\/]/g, '_').slice(0, 150);
  const mime = (req.headers.get('content-type') || 'application/octet-stream').slice(0, 120);
  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length) return erro('Arquivo vazio.');
  if (buf.length > MAX) return erro('O arquivo passa de 4 MB.', 413);
  const id = novoId('f');
  await db()`insert into arquivos (id, instrutor_id, aluno_id, nome, mime, tamanho, conteudo)
    values (${id}, ${s.papel === 'prof' ? s.id : null}, ${s.papel === 'aluno' ? s.id : null}, ${nome}, ${mime}, ${buf.length}, ${buf})`;
  return json({ id, nome });
}
