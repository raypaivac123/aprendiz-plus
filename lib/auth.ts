// © Rayssa Paiva · Todos os direitos reservados
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { db } from './db';

export type Papel = 'prof' | 'aluno';
export type Sessao = { papel: Papel; id: string; admin?: boolean; turma?: string; nome?: string };

const COOKIE = 'ap_sessao';
const DURACAO = 60 * 60 * 12; // 12 horas

function segredo() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 24) throw new Error('AUTH_SECRET ausente ou curto demais (use 24+ caracteres).');
  return new TextEncoder().encode(s);
}

export async function criarSessao(papel: Papel, id: string) {
  const token = await new SignJWT({ papel, id }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(`${DURACAO}s`).sign(segredo());
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: DURACAO });
}

export async function encerrarSessao() {
  (await cookies()).delete(COOKIE);
}

/** Lê o cookie e confere no banco se a conta continua válida. */
export async function sessao(): Promise<Sessao | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  let p: { papel?: Papel; id?: string };
  try { p = (await jwtVerify(token, segredo())).payload as typeof p; } catch { return null; }
  if (!p.id || (p.papel !== 'prof' && p.papel !== 'aluno')) return null;
  const sql = db();
  if (p.papel === 'prof') {
    const [i] = await sql`select id, admin, ativo, nome from instrutores where id = ${p.id}`;
    if (!i || !i.ativo) return null;
    return { papel: 'prof', id: i.id, admin: i.admin, nome: i.nome };
  }
  const [a] = await sql`select a.id, a.ativo, a.expira, a.turma_id, a.nome, t.dados->>'fechada' as fechada
    from alunos a join turmas t on t.id = a.turma_id where a.id = ${p.id}`;
  if (!a || !a.ativo || a.fechada || (a.expira && new Date(a.expira) < new Date())) return null;
  return { papel: 'aluno', id: a.id, turma: a.turma_id, nome: a.nome };
}

export const json = (dados: unknown, status = 200) => Response.json(dados, { status, headers: { 'Cache-Control': 'no-store' } });
export const erro = (mensagem: string, status = 400) => json({ erro: mensagem }, status);

export function senhaFraca(s: string) {
  return s.length < 8 || !/\d/.test(s) || !/[a-z]/i.test(s);
}
