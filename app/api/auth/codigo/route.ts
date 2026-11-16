// © Rayssa Paiva · Todos os direitos reservados
// Segunda etapa do login: confere o código enviado por e-mail (ou reenvia).
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { criarSessao, encerrarDesafio, erro, json, lerDesafio } from '@/lib/auth';
import { MAX_TENTATIVAS, gerarEEnviar } from '@/lib/codigo';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const id = await lerDesafio();
  if (!id) return erro('O tempo para digitar o código acabou. Entre de novo com usuário e senha.', 401);
  const b = await req.json().catch(() => ({}));
  const sql = db();
  const [ins] = await sql`select id, nome, email, ativo from instrutores where id = ${id}`;
  if (!ins || !ins.ativo || !ins.email) { await encerrarDesafio(); return erro('Conta indisponível.', 403); }

  if (b.reenviar) {
    try {
      const r = await gerarEEnviar(sql, ins, true);
      if (r.espera) return erro(`Aguarde ${r.espera} segundos para pedir outro código.`, 429);
      return json({ ok: true });
    } catch {
      return erro('Não foi possível enviar o código agora.', 502);
    }
  }

  const codigo = String(b.codigo ?? '').replace(/\D/g, '');
  if (codigo.length !== 6) return erro('Digite os 6 números do código.');
  const [c] = await sql`select codigo_hash, expira, tentativas from codigos_acesso where instrutor_id = ${id}`;
  if (!c || new Date(c.expira) < new Date()) return erro('Este código expirou. Clique em "Enviar outro código".', 400);
  if (c.tentativas >= MAX_TENTATIVAS) return erro('Muitas tentativas erradas. Clique em "Enviar outro código".', 429);
  if (!(await bcrypt.compare(codigo, c.codigo_hash))) {
    await sql`update codigos_acesso set tentativas = tentativas + 1 where instrutor_id = ${id}`;
    const restam = MAX_TENTATIVAS - c.tentativas - 1;
    return erro(restam > 0 ? `Código incorreto. Restam ${restam} tentativa(s).` : 'Muitas tentativas erradas. Clique em "Enviar outro código".', 400);
  }
  await sql`delete from codigos_acesso where instrutor_id = ${id}`;
  await encerrarDesafio();
  await criarSessao('prof', id);
  return json({ ok: true });
}
