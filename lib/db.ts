// © Rayssa Paiva · Todos os direitos reservados
import postgres from 'postgres';

export type Sql = ReturnType<typeof postgres>;
const g = globalThis as unknown as { __apSql?: Sql };

/** Conexão única reaproveitada entre as requisições. */
export function db(): Sql {
  if (g.__apSql) return g.__apSql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não configurada.');
  g.__apSql = postgres(url, {
    prepare: false, // obrigatório no pooler de transação do Supabase
    max: 5,
    idle_timeout: 20,
    ssl: process.env.DATABASE_SSL === 'false' ? false : 'require',
  });
  return g.__apSql;
}

export const novoId = (pref = '') => pref + crypto.randomUUID().replace(/-/g, '').slice(0, 14);
