// © Rayssa Paiva · Todos os direitos reservados
// Meu perfil: foto e "sobre mim" (aprendiz e instrutor).
import { db } from '@/lib/db';
import { erro, json, sessao } from '@/lib/auth';
import { fotoValida, textoSobre } from '@/lib/foto';

export async function POST(req: Request) {
  const s = await sessao();
  if (!s) return erro('Sessão expirada. Entre de novo.', 401);
  const b = await req.json().catch(() => ({}));
  const sql = db();
  const tabela = s.papel === 'prof' ? 'instrutores' : 'alunos';
  if (b.removerFoto) await sql`update ${sql(tabela)} set foto = null where id = ${s.id}`;
  else if (b.foto !== undefined) {
    const f = fotoValida(b.foto);
    if (!f) return erro('Não foi possível usar essa foto. Tente outra imagem.');
    await sql`update ${sql(tabela)} set foto = ${f} where id = ${s.id}`;
  }
  if (b.sobre !== undefined) await sql`update ${sql(tabela)} set sobre = ${textoSobre(b.sobre)} where id = ${s.id}`;
  return json({ ok: true });
}
