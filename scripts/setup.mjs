// © Rayssa Paiva · Todos os direitos reservados
// Cria as tabelas e a primeira conta de administradora.
// Uso: preencha .env.local e rode `npm run setup`
import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';

const url = process.env.DATABASE_URL;
if (!url) { console.error('Configure DATABASE_URL no .env.local'); process.exit(1); }
const sql = postgres(url, { prepare: false, ssl: process.env.DATABASE_SSL === 'false' ? false : 'require', max: 1 });

const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
await sql.unsafe(schema);
console.log('✔ Tabelas prontas.');

const nome = process.env.ADMIN_NOME || 'Administradora';
const usuario = (process.env.ADMIN_USUARIO || 'admin').toLowerCase();
const email = (process.env.ADMIN_EMAIL || '').toLowerCase() || null;

const [existe] = await sql`select id from instrutores where usuario = ${usuario}`;
if (existe) {
  console.log(`✔ A conta "${usuario}" já existe. Nada foi alterado.`);
} else {
  const senha = randomBytes(6).toString('base64url');
  const hash = await bcrypt.hash(senha, 10);
  await sql`insert into instrutores (id, nome, usuario, email, senha_hash, admin, ativo, primeiro)
    values (${'i' + randomUUID().replace(/-/g, '').slice(0, 14)}, ${nome}, ${usuario}, ${email}, ${hash}, true, true, true)`;
  console.log('\n✔ Administradora criada');
  console.log('  Usuário: ' + usuario);
  console.log('  Senha provisória: ' + senha);
  console.log('  (no primeiro acesso a plataforma pede uma senha pessoal)\n');
}
await sql.end();
