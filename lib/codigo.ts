// © Rayssa Paiva · Todos os direitos reservados
// Código de 6 dígitos da verificação em duas etapas.
import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import type { Sql } from './db';
import { emailCodigo, enviarEmail } from './email';

export const VALIDADE_MIN = 10;
export const MAX_TENTATIVAS = 5;
export const INTERVALO_REENVIO_S = 60;

/** Gera um código novo, guarda só o hash e envia por e-mail. */
export async function gerarEEnviar(sql: Sql, ins: Record<string, any>, reenvio = false) {
  if (reenvio) {
    const [c] = await sql`select extract(epoch from (now() - enviado_em)) as passou from codigos_acesso where instrutor_id = ${ins.id}`;
    if (c && Number(c.passou) < INTERVALO_REENVIO_S) return { espera: Math.ceil(INTERVALO_REENVIO_S - Number(c.passou)) };
  }
  const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const hash = await bcrypt.hash(codigo, 8);
  await sql`insert into codigos_acesso (instrutor_id, codigo_hash, expira, tentativas, enviado_em)
    values (${ins.id}, ${hash}, now() + ${VALIDADE_MIN + ' minutes'}::interval, 0, now())
    on conflict (instrutor_id) do update set codigo_hash = excluded.codigo_hash, expira = excluded.expira, tentativas = 0, enviado_em = now()`;
  const { html, texto } = emailCodigo(ins.nome, codigo);
  await enviarEmail(ins.email, `${codigo} é o seu código de acesso ao Aprendiz+`, html, texto);
  return { espera: 0 };
}
