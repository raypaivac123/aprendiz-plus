// © Rayssa Paiva · Todos os direitos reservados
import postgres from 'postgres';
import { SCHEMA } from './schema';

export type Sql = ReturnType<typeof postgres>;
const g = globalThis as unknown as { __apSql?: Sql; __apEsquema?: Promise<void> };

/** Endereço do banco: DATABASE_URL ou, se não houver, o POSTGRES_URL criado pela integração Supabase da Vercel. */
function endereco() {
  const bruto = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!bruto) throw new Error('Banco não configurado (DATABASE_URL ou POSTGRES_URL).');
  // A integração acrescenta parâmetros (?sslmode=…&supa=…) que o driver não reconhece.
  const u = new URL(bruto);
  u.search = '';
  return u.toString();
}

/** Conexão única reaproveitada entre as requisições. */
export function db(): Sql {
  if (g.__apSql) return g.__apSql;
  g.__apSql = postgres(endereco(), {
    prepare: false, // obrigatório no pooler de transação do Supabase
    max: 5,
    idle_timeout: 20,
    ssl: process.env.DATABASE_SSL === 'false' ? false : 'require',
  });
  return g.__apSql;
}

/** Cria as tabelas que ainda não existem (uma vez por instância). */
export function garantirEsquema(): Promise<void> {
  if (!g.__apEsquema) {
    g.__apEsquema = db().unsafe(SCHEMA).then(() => undefined).catch((e) => { g.__apEsquema = undefined; throw e; });
  }
  return g.__apEsquema;
}

export const novoId = (pref = '') => pref + crypto.randomUUID().replace(/-/g, '').slice(0, 14);
