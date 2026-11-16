-- Aprendiz+ · esquema do banco (PostgreSQL / Supabase)
-- © Rayssa Paiva · Todos os direitos reservados
-- Pode rodar quantas vezes quiser: só cria o que ainda não existe.

create table if not exists instrutores (
  id          text primary key,
  nome        text not null,
  usuario     text not null unique,
  email       text unique,
  senha_hash  text,
  admin       boolean not null default false,
  ativo       boolean not null default true,
  primeiro    boolean not null default true,
  criado_em   timestamptz not null default now()
);

create table if not exists turmas (
  id           text primary key,
  instrutor_id text not null references instrutores(id) on delete cascade,
  dados        jsonb not null,           -- nome, codigo, uc, inicio, dias, fecha, fechada, relatorio
  criado_em    timestamptz not null default now()
);
create index if not exists turmas_instrutor_idx on turmas(instrutor_id);

create table if not exists alunos (
  id          text primary key,
  turma_id    text not null references turmas(id) on delete cascade,
  nome        text not null,
  usuario     text not null unique,
  senha_hash  text,
  primeiro    boolean not null default true,
  ativo       boolean not null default true,
  expira      timestamptz,
  criado_em   timestamptz not null default now()
);
create index if not exists alunos_turma_idx on alunos(turma_id);

-- Meus materiais: nunca são apagados quando a turma encerra
create table if not exists materiais (
  id        text primary key,
  tipo      text not null check (tipo in ('aula','banco','questionario','dinamica','slide','jogo')),
  dono_id   text not null references instrutores(id) on delete cascade,
  dados     jsonb not null,
  criado_em timestamptz not null default now()
);
create index if not exists materiais_dono_idx on materiais(dono_id, tipo);

create table if not exists atividades (
  id        text primary key,
  turma_id  text not null references turmas(id) on delete cascade,
  dados     jsonb not null,               -- banco | fonte+ref, aula, prazo
  criado_em timestamptz not null default now()
);
create index if not exists atividades_turma_idx on atividades(turma_id);

create table if not exists entregas (
  id           text primary key,
  atividade_id text not null references atividades(id) on delete cascade,
  aluno_id     text not null references alunos(id) on delete cascade,
  status       text not null default 'entregue' check (status in ('entregue','atendido','nao_atendido')),
  dados        jsonb not null,            -- texto, respostas, arquivo, arquivoId, fb, quando
  unique (atividade_id, aluno_id)
);

create table if not exists avisos (
  id        text primary key,
  turma_id  text not null references turmas(id) on delete cascade,
  dados     jsonb not null,               -- autor, texto, quando, fixado
  criado_em timestamptz not null default now()
);
create index if not exists avisos_turma_idx on avisos(turma_id);

create table if not exists leituras (
  aluno_id text not null references alunos(id) on delete cascade,
  tipo     text not null check (tipo in ('aviso','aula')),
  ref_id   text not null,
  primary key (aluno_id, tipo, ref_id)
);

-- Arquivos ficam no próprio banco (até 4 MB cada). Os dos aprendizes somem com a conta.
create table if not exists arquivos (
  id           text primary key,
  instrutor_id text references instrutores(id) on delete cascade,
  aluno_id     text references alunos(id) on delete cascade,
  nome         text not null,
  mime         text not null,
  tamanho      integer not null,
  conteudo     bytea not null,
  criado_em    timestamptz not null default now()
);

create table if not exists config (
  chave text primary key,
  valor jsonb not null
);
insert into config (chave, valor) values ('duracao', '20') on conflict do nothing;

-- Quiz ao vivo
create table if not exists jogo_sessoes (
  codigo       text primary key,
  instrutor_id text not null references instrutores(id) on delete cascade,
  jogo         jsonb not null,
  fase         text not null default 'lobby',
  idx          integer not null default -1,
  inicio       timestamptz,
  criado_em    timestamptz not null default now()
);
create table if not exists jogo_jogadores (
  codigo   text not null references jogo_sessoes(codigo) on delete cascade,
  aluno_id text not null,
  nome     text not null,
  pontos   integer not null default 0,
  primary key (codigo, aluno_id)
);
create table if not exists jogo_respostas (
  codigo   text not null references jogo_sessoes(codigo) on delete cascade,
  aluno_id text not null,
  idx      integer not null,
  escolha  integer not null,
  pontos   integer not null default 0,
  primary key (codigo, aluno_id, idx)
);

-- O app acessa o banco só pelo servidor (DATABASE_URL). Liga o RLS sem políticas para
-- que a API pública do Supabase (chave anon) não enxergue nenhuma tabela.
alter table instrutores    enable row level security;
alter table turmas         enable row level security;
alter table alunos         enable row level security;
alter table materiais      enable row level security;
alter table atividades     enable row level security;
alter table entregas       enable row level security;
alter table avisos         enable row level security;
alter table leituras       enable row level security;
alter table arquivos       enable row level security;
alter table config         enable row level security;
alter table jogo_sessoes   enable row level security;
alter table jogo_jogadores enable row level security;
alter table jogo_respostas enable row level security;

-- Proteção contra tentativas de senha em sequência
create table if not exists tentativas_login (
  chave   text primary key,
  falhas  integer not null default 0,
  ate     timestamptz
);
alter table tentativas_login enable row level security;
