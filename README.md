# Aprendiz+

Plataforma de aulas, atividades, correções, mural e quiz ao vivo para as turmas do Programa de Aprendizagem Profissional.

© Rayssa Paiva · Todos os direitos reservados.

## O que tem aqui

| Parte | Tecnologia | Onde fica |
|---|---|---|
| Front-end | HTML + Tailwind (já compilado) + JavaScript | `public/app.html` |
| Back-end | Next.js 15 (rotas de API em TypeScript) | `app/api/*`, `lib/*` |
| Banco de dados | PostgreSQL (Supabase, plano gratuito) | `db/schema.sql` |
| IA | Llama 3.3 70B pela Groq (gratuito) ou Ollama local | `app/api/ia/route.ts` |
| Hospedagem | Vercel (plano gratuito) + rotina diária | `vercel.json` |

**Funções do servidor**
- Login com senha criptografada (bcrypt) e sessão em cookie seguro (12 h).
- Cada pessoa só vê e altera o que é dela: o instrutor vê as próprias turmas e os próprios materiais, e o aprendiz vê só a própria turma e as próprias entregas.
- Arquivos de até 4 MB ficam no banco. Os arquivos dos aprendizes são apagados junto com a conta.
- A turma fecha sozinha no fim do prazo. Nesse momento o sistema gera o relatório final e exclui as contas dos aprendizes; os Meus materiais continuam guardados.
- O quiz ao vivo funciona assim: a tela projetada mostra um código e os aprendizes entram pelo celular.

## Publicar (cerca de 20 minutos)

### 1. GitHub
1. Crie um repositório **privado** chamado `aprendiz-plus`.
2. Envie esta pasta:
   ```bash
   git init
   git add .
   git commit -m "Aprendiz+ v1"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/aprendiz-plus.git
   git push -u origin main
   ```
   O `.gitignore` já impede o envio do `.env.local` com as senhas.

### 2. Banco no Supabase
1. Crie um projeto em [supabase.com](https://supabase.com). Para ficar perto do Brasil, escolha a região **South America (São Paulo)**.
2. Abra **SQL Editor**, cole todo o conteúdo de `db/schema.sql` e clique em **Run**.
3. Em **Connect** (ou Project Settings → Database), copie a *connection string* do **Transaction pooler**, a que usa a porta **6543**. Esse é o `DATABASE_URL`.

### 3. Chave da IA (Llama)
1. Entre em [console.groq.com/keys](https://console.groq.com/keys) e crie uma chave grátis.
2. Guarde a chave: ela é o `LLM_API_KEY`. O modelo padrão é `openai/gpt-oss-120b`.

### 4. Primeira administradora
No seu computador, com Node 20 ou mais novo:
```bash
cp .env.example .env.local      # preencha DATABASE_URL, AUTH_SECRET etc.
npm install
npm run setup
```
O comando mostra o **usuário** e a **senha provisória**. No primeiro acesso a plataforma pede uma senha pessoal.

### 5. Vercel
1. Em [vercel.com](https://vercel.com) → **Add New → Project**, importe o repositório.
2. Em **Environment Variables**, cadastre:

   | Nome | Valor |
   |---|---|
   | `DATABASE_URL` | connection string do pooler (porta 6543) |
   | `AUTH_SECRET` | texto aleatório longo (`openssl rand -base64 48`) |
   | `CRON_SECRET` | outro texto aleatório |
   | `LLM_API_KEY` | chave da Groq |
   | `LLM_BASE_URL` | `https://api.groq.com/openai/v1` |
   | `LLM_MODEL` | `openai/gpt-oss-120b` |

3. Clique em **Deploy**. Depois disso, cada `git push` publica uma nova versão automaticamente.

A rotina diária (`/api/cron`, às 9h UTC) encerra as turmas vencidas. Ela também mantém o projeto do Supabase ativo, porque o plano grátis pausa projetos parados há 7 dias.

## Rodar no computador
```bash
npm install
npm run dev     # http://localhost:3000
```

### Usar Llama local com Ollama
```bash
ollama pull llama3.1
```
No `.env.local`:
```
LLM_BASE_URL=http://localhost:11434/v1
LLM_API_KEY=ollama
LLM_MODEL=llama3.1
```
O Ollama funciona só quando o servidor roda na mesma máquina. Na Vercel use a Groq ou outro serviço compatível com a API da OpenAI.

## Estrutura
```
app/api/auth/login|logout|senha   login, saída e primeiro acesso
app/api/dados                     carrega o que o perfil pode ver
app/api/sync                      grava as alterações com checagem de permissão
app/api/arquivos                  envio e download de arquivos
app/api/ia                        IA (Llama) com resposta em tempo real
app/api/jogo                      quiz ao vivo
app/api/cron                      rotina diária
lib/                              banco, sessão, regras de acesso
db/schema.sql                     tabelas
public/app.html                   interface
scripts/setup.mjs                 cria tabelas e a administradora
```

## Limites do plano gratuito
- Supabase: 500 MB de banco. Arquivos de até 4 MB cada.
- Vercel Hobby: suficiente para algumas turmas. O quiz consulta o servidor a cada segundo enquanto o jogo está aberto.
- Groq: limite diário generoso de pedidos. Se aparecer "Muitos pedidos seguidos", espere alguns segundos.
