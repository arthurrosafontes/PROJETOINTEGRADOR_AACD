// =====================================================
// BACKEND COMPLETO: servidor + API + banco de dados
// Rode com: npm install  e depois  npm start
// =====================================================
const path = require("path");
const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");

const PORTA = process.env.PORT || 3000;

// Data de hoje no formato AAAA-MM-DD (horário local)
function hojeISO() {
  const hoje = new Date();
  hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
  return hoje.toISOString().slice(0, 10);
}

// =====================================================
// 1. BANCO DE DADOS (SQLite)
// Cria o arquivo banco.db na primeira execução e
// preenche as tabelas vazias com dados de exemplo.
// =====================================================
const db = new Database(path.join(__dirname, "banco.db"));

const SCHEMA = `
  -- Tela: Cadastro de demanda (próteses já cadastradas, usadas como modelo)
  CREATE TABLE IF NOT EXISTS proteses (
    id            TEXT    PRIMARY KEY,       -- ex.: PRT-001
    nome          TEXT    NOT NULL,
    tipo          TEXT,
    regiao        TEXT,
    filamento     TEXT,
    bico          TEXT,                      -- mm
    largura       REAL,                      -- mm
    profundidade  REAL,                      -- mm
    altura        REAL,                      -- mm
    horas         INTEGER NOT NULL DEFAULT 0,
    minutos       INTEGER NOT NULL DEFAULT 0
  );

  -- Tela: Cadastro de demanda (demandas publicadas)
  CREATE TABLE IF NOT EXISTS demandas (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    nome                TEXT    NOT NULL,
    protese_id          TEXT,                -- prótese usada como modelo (opcional)
    quantidade          INTEGER NOT NULL CHECK (quantidade > 0),
    tipo                TEXT    NOT NULL,
    regiao              TEXT    NOT NULL,
    paciente            TEXT    NOT NULL,    -- ex.: PAC-001
    prioridade          TEXT    NOT NULL,
    arquivo             TEXT,                -- nome do arquivo enviado
    observacoes         TEXT,
    filamento           TEXT    NOT NULL,
    bico                REAL    NOT NULL,    -- mm
    largura             REAL    NOT NULL,    -- mm
    profundidade        REAL    NOT NULL,    -- mm
    altura              REAL    NOT NULL,    -- mm
    tempo_estimado_min  INTEGER NOT NULL,    -- minutos por unidade
    prazo               TEXT    NOT NULL,    -- AAAA-MM-DD
    forma_entrega       TEXT    NOT NULL,
    local_entrega       TEXT    NOT NULL,
    responsavel         TEXT    NOT NULL,
    instrucoes          TEXT,
    criado              TEXT    NOT NULL     -- AAAA-MM-DD
  );

  -- Tela: Voluntários (gestão)
  CREATE TABLE IF NOT EXISTS voluntarios (
    id            INTEGER PRIMARY KEY,
    nome          TEXT    NOT NULL,
    cidade        TEXT,
    status        TEXT    NOT NULL DEFAULT 'Pendente'
                  CHECK (status IN ('Pendente', 'Ativo', 'Inativo')),
    materiais     TEXT,                      -- as impressoras ficam na tabela "impressoras"
    entregues     INTEGER NOT NULL DEFAULT 0,
    em_producao   INTEGER NOT NULL DEFAULT 0,
    email         TEXT,
    telefone      TEXT,
    cadastro      TEXT    NOT NULL           -- AAAA-MM-DD
  );

  -- Tela: Impressoras cadastradas (cada impressora é de um voluntário)
  CREATE TABLE IF NOT EXISTS impressoras (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    voluntario_id INTEGER NOT NULL REFERENCES voluntarios(id),
    modelo        TEXT    NOT NULL,
    tecnologia    TEXT    NOT NULL DEFAULT 'FDM'
                  CHECK (tecnologia IN ('FDM', 'Resina')),
    largura       REAL,                      -- área de impressão, mm
    profundidade  REAL,                      -- mm
    altura        REAL,                      -- mm
    bico          TEXT,                      -- mm (vazio para resina)
    materiais     TEXT,
    obs           TEXT,
    cadastro      TEXT    NOT NULL           -- AAAA-MM-DD
  );

  -- Tela: Pedidos Disponíveis
  CREATE TABLE IF NOT EXISTS pedidos_disponiveis (
    id            INTEGER PRIMARY KEY,
    peca          TEXT    NOT NULL,
    material      TEXT,
    quantidade    INTEGER NOT NULL DEFAULT 1,
    prazo         TEXT    NOT NULL,          -- AAAA-MM-DD
    criado        TEXT    NOT NULL,          -- AAAA-MM-DD
    prioridade    TEXT    NOT NULL DEFAULT 'Média'
                  CHECK (prioridade IN ('Alta', 'Média', 'Baixa')),
    tempo         TEXT,                      -- tempo estimado de impressão
    obs           TEXT,
    aceito_em     TEXT,                      -- vazio = ainda disponível
    voluntario_id INTEGER                    -- quem aceitou
  );

  -- Tela: Pedidos Aceitos
  CREATE TABLE IF NOT EXISTS pedidos (
    id            INTEGER PRIMARY KEY,
    produto       TEXT    NOT NULL,
    categoria     TEXT    NOT NULL,
    status        TEXT    NOT NULL DEFAULT 'Pendente'
                  CHECK (status IN ('Pendente', 'Em produção', 'Concluído')),
    aceito_em     TEXT    NOT NULL,          -- AAAA-MM-DD
    material      TEXT,
    prazo         TEXT,                      -- AAAA-MM-DD
    obs           TEXT,
    voluntario_id INTEGER                    -- quem aceitou o pedido
  );

  -- Tela: Em Produção
  CREATE TABLE IF NOT EXISTS producao (
    id            INTEGER PRIMARY KEY,
    paciente      TEXT    NOT NULL,
    peca          TEXT    NOT NULL,
    status        TEXT    NOT NULL DEFAULT 'Em produção'
                  CHECK (status IN ('Em produção', 'Aguardando validação', 'Concluída')),
    entrega       TEXT    NOT NULL,          -- prazo de entrega, AAAA-MM-DD
    enviado       TEXT,                      -- quando foi enviada para validação
    concluido     TEXT,                      -- quando a equipe aprovou
    material      TEXT,
    impressora    TEXT,
    progresso     INTEGER NOT NULL DEFAULT 0 CHECK (progresso BETWEEN 0 AND 100),
    obs           TEXT,
    voluntario_id INTEGER
  );
`;

const EXEMPLO_PROTESES = `
  INSERT INTO proteses (id, nome, tipo, regiao, filamento, bico, largura, profundidade, altura, horas, minutos) VALUES
    ('PRT-001', 'Mão infantil articulada', 'Prótese',   'Mão',             'PLA',  '0.4', 85,  60,  140, 6, 30),
    ('PRT-002', 'Órtese de punho',         'Órtese',    'Membro superior', 'PETG', '0.6', 110, 80,  95,  8, 0),
    ('PRT-003', 'Adaptador de talher',     'Adaptador', 'Mão',             'TPU',  '0.4', 45,  30,  120, 2, 15),
    ('PRT-004', 'Palmilha ortopédica M',   'Palmilha',  'Pé',              'TPU',  '0.6', 100, 270, 25,  5, 45);
`;

const EXEMPLO_VOLUNTARIOS = `
  INSERT INTO voluntarios (id, nome, cidade, status, materiais, entregues, em_producao, email, telefone, cadastro) VALUES
    (301, 'Rafael Martins', 'São Paulo - SP', 'Ativo',    'PLA, PETG, TPU', 14, 2, 'rafael.martins@email.com', '(11) 98765-4321', '2026-03-12'),
    (302, 'Juliana Costa',  'Campinas - SP',  'Ativo',    'PLA, PETG',      9,  1, 'juliana.costa@email.com',  '(19) 99876-5432', '2026-05-02'),
    (303, 'Pedro Almeida',  'Santos - SP',    'Pendente', 'PLA',            0,  0, 'pedro.almeida@email.com',  '(13) 99123-4567', '2026-10-10'),
    (304, 'Fernanda Lopes', 'Guarulhos - SP', 'Ativo',    'PLA, TPU',       21, 3, 'fernanda.lopes@email.com', '(11) 97654-3210', '2026-01-20'),
    (305, 'Lucas Ferreira', 'Sorocaba - SP',  'Inativo',  'PLA',            4,  0, 'lucas.ferreira@email.com', '(15) 98888-1122', '2026-02-08'),
    (306, 'Camila Ribeiro', 'São Paulo - SP', 'Pendente', 'Resina',         0,  0, 'camila.ribeiro@email.com', '(11) 96543-2109', '2026-10-12');
`;

const EXEMPLO_IMPRESSORAS = `
  INSERT INTO impressoras (voluntario_id, modelo, tecnologia, largura, profundidade, altura, bico, materiais, obs, cadastro) VALUES
    (301, 'Ender 3 V2',       'FDM',    220, 220, 250, '0.4', 'PLA, PETG',      'Mesa de vidro.',                    '2026-03-12'),
    (301, 'Bambu Lab P1S',    'FDM',    256, 256, 256, '0.4', 'PLA, PETG, TPU', 'Fechada, boa para PETG.',           '2026-06-03'),
    (302, 'Prusa MK4',        'FDM',    250, 210, 220, '0.4', 'PLA, PETG',      NULL,                                '2026-05-02'),
    (303, 'Ender 3 S1',       'FDM',    220, 220, 270, '0.4', 'PLA',            'Aguardando aprovação do voluntário.', '2026-10-10'),
    (304, 'Bambu Lab A1',     'FDM',    256, 256, 256, '0.4', 'PLA, TPU',       NULL,                                '2026-01-20'),
    (305, 'Anycubic Kobra 2', 'FDM',    220, 220, 250, '0.6', 'PLA',            'Bico de 0.6 instalado.',            '2026-02-08'),
    (306, 'Elegoo Saturn 3',  'Resina', 219, 123, 250, NULL,  'Resina',         'Impressora de resina.',             '2026-10-12');
`;

const EXEMPLO_DISPONIVEIS = `
  INSERT INTO pedidos_disponiveis (id, peca, material, quantidade, prazo, criado, prioridade, tempo, obs) VALUES
    (1024, 'Órtese de punho',               'PLA',  1, '2026-10-15', '2026-10-08', 'Alta',  '4h',    'Tamanho M, lado direito.'),
    (1023, 'Adaptador de talher',           'PETG', 3, '2026-10-20', '2026-10-07', 'Média', '1h30',  'Cor azul, se possível.'),
    (1022, 'Mão protética infantil',        'PLA',  1, '2026-10-14', '2026-10-06', 'Alta',  '12h',   'Escala 110%. Arquivo STL anexado ao pedido.'),
    (1021, 'Engrossador de lápis',          'TPU',  5, '2026-10-30', '2026-10-05', 'Baixa', '45min', 'Material flexível obrigatório.'),
    (1020, 'Suporte para celular adaptado', 'PLA',  2, '2026-10-25', '2026-10-04', 'Média', '3h',    'Para uso em cadeira de rodas.'),
    (1019, 'Órtese de dedo',                'PETG', 2, '2026-11-02', '2026-10-02', 'Baixa', '40min', 'Tamanhos P e M.');
`;

const EXEMPLO_PEDIDOS = `
  INSERT INTO pedidos (id, produto, categoria, status, aceito_em, material, prazo, obs, voluntario_id) VALUES
    (1024, 'Órtese de punho',     'Membro superior', 'Pendente',    '2026-10-09', 'TPU',  '2026-11-15', 'Material flexível obrigatório.', 1),
    (1025, 'Prótese ortopédica',  'Membro inferior', 'Em produção', '2026-10-08', 'PETG', '2026-11-02', 'Imprimir em duas partes.',       1),
    (1026, 'Palmilha ortopédica', 'Apoio plantar',   'Concluído',   '2026-10-06', 'TPU',  '2026-10-10', 'Par completo, tamanho 38.',      1);
`;

const EXEMPLO_PRODUCAO = `
  INSERT INTO producao (id, paciente, peca, status, entrega, enviado, concluido, material, impressora, progresso, obs, voluntario_id) VALUES
    (1018, 'Ana Lima',       'Prótese de dedo',      'Em produção',          '2026-10-05', NULL,         NULL,         'PLA',  'Ender 3 V2',    70,  'Tamanho P, mão esquerda.',       1),
    (1015, 'Beatriz Rocha',  'Prótese de mão',       'Em produção',          '2026-10-08', NULL,         NULL,         'PETG', 'Bambu Lab P1S', 45,  'Escala 105%.',                   1),
    (1012, 'João Pereira',   'Prótese de antebraço', 'Em produção',          '2026-10-12', NULL,         NULL,         'PLA',  'Ender 3 V2',    85,  'Imprimir em duas partes.',       1),
    (1010, 'Maria Souza',    'Prótese de mão',       'Em produção',          '2026-10-30', NULL,         NULL,         'PLA',  'Bambu Lab P1S', 20,  'Cor azul, se possível.',         1),
    (1008, 'Lucas Oliveira', 'Prótese de braço',     'Em produção',          '2026-11-02', NULL,         NULL,         'PETG', 'Ender 3 V2',    10,  'Arquivo STL anexado ao pedido.', 1),
    (1005, 'Carlos Mendes',  'Órtese de punho',      'Em produção',          '2026-11-15', NULL,         NULL,         'TPU',  'Bambu Lab P1S', 0,   'Material flexível obrigatório.', 1),
    (1003, 'Paula Nunes',    'Adaptador de talher',  'Aguardando validação', '2026-10-20', '2026-10-13', NULL,         'PETG', 'Ender 3 V2',    100, 'Três unidades, cor azul.',       1),
    (1001, 'Rodrigo Silva',  'Órtese de dedo',       'Aguardando validação', '2026-10-22', '2026-10-14', NULL,         'PLA',  'Bambu Lab P1S', 100, 'Tamanhos P e M.',                1),
    (998,  'Mariana Alves',  'Palmilha ortopédica',  'Concluída',            '2026-10-10', '2026-10-06', '2026-10-09', 'TPU',  'Ender 3 V2',    100, 'Par completo, tamanho 38.',      1),
    (995,  'Tiago Santos',   'Engrossador de lápis', 'Concluída',            '2026-10-03', '2026-09-29', '2026-10-01', 'TPU',  'Bambu Lab P1S', 100, 'Cinco unidades.',                1);
`;

db.exec(SCHEMA);

function tabelaVazia(tabela) {
  return db.prepare(`SELECT COUNT(*) AS total FROM ${tabela}`).get().total === 0;
}
if (tabelaVazia("proteses")) db.exec(EXEMPLO_PROTESES);
if (tabelaVazia("voluntarios")) db.exec(EXEMPLO_VOLUNTARIOS);
if (tabelaVazia("impressoras")) db.exec(EXEMPLO_IMPRESSORAS);
if (tabelaVazia("pedidos_disponiveis")) db.exec(EXEMPLO_DISPONIVEIS);
if (tabelaVazia("pedidos")) db.exec(EXEMPLO_PEDIDOS);
if (tabelaVazia("producao")) db.exec(EXEMPLO_PRODUCAO);

// ----- Consultas: Próteses e Demandas -----
function listarProteses() {
  return db.prepare("SELECT * FROM proteses ORDER BY id").all();
}

function listarDemandas() {
  return db.prepare("SELECT * FROM demandas ORDER BY id DESC").all();
}

function buscarDemanda(id) {
  return db.prepare("SELECT * FROM demandas WHERE id = ?").get(id);
}

// Confere a demanda antes de salvar. Devolve a lista de erros (vazia = tudo certo).
// A tela já valida, mas a API confere de novo porque qualquer um pode chamar a API direto.
function validarDemanda(d) {
  const erros = [];
  const imp = d.impressao || {};
  const ent = d.entrega || {};
  const vazio = v => v === undefined || v === null || String(v).trim() === "";

  [["nome", d.nome], ["tipo", d.tipo], ["regiao", d.regiao], ["prioridade", d.prioridade],
   ["filamento", imp.filamento], ["prazo", ent.prazo], ["formaEntrega", ent.forma],
   ["unidade", ent.local], ["responsavel", ent.responsavel]]
    .forEach(([campo, v]) => { if (vazio(v)) erros.push(`O campo "${campo}" é obrigatório.`); });

  if (!Number.isInteger(d.quantidade) || d.quantidade <= 0) erros.push("A quantidade deve ser um número inteiro maior que zero.");
  if (!/^PAC-\d{3,}$/i.test(String(d.paciente || "").trim())) erros.push("O código do paciente deve estar no formato PAC-000.");
  if (!(Number(imp.bico) > 0)) erros.push("O bico deve ser maior que zero.");
  ["largura", "profundidade", "altura"].forEach(m => {
    if (!(Number(imp[m]) > 0)) erros.push(`A ${m} deve ser maior que zero.`);
  });
  if (!(Number(imp.tempoEstimadoMin) > 0)) erros.push("O tempo estimado deve ser maior que zero.");
  if (!vazio(ent.prazo) && ent.prazo < hojeISO()) erros.push("O prazo não pode ser no passado.");

  return erros;
}

function salvarDemanda(d) {
  const resultado = db.prepare(`
    INSERT INTO demandas (
      nome, protese_id, quantidade, tipo, regiao, paciente, prioridade, arquivo, observacoes,
      filamento, bico, largura, profundidade, altura, tempo_estimado_min,
      prazo, forma_entrega, local_entrega, responsavel, instrucoes, criado
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    d.nome.trim(), d.proteseId || null, d.quantidade, d.tipo, d.regiao,
    String(d.paciente).trim().toUpperCase(), d.prioridade, d.arquivo || null, d.observacoes || null,
    d.impressao.filamento, Number(d.impressao.bico), Number(d.impressao.largura),
    Number(d.impressao.profundidade), Number(d.impressao.altura), Number(d.impressao.tempoEstimadoMin),
    d.entrega.prazo, d.entrega.forma, d.entrega.local, d.entrega.responsavel, d.entrega.instrucoes || null,
    hojeISO()
  );
  return buscarDemanda(resultado.lastInsertRowid);
}

// ----- Consultas: Impressoras -----
// Junta cada impressora com os dados do voluntário dono dela
const CONSULTA_IMPRESSORAS = `
  SELECT i.id, i.modelo, i.tecnologia, i.largura, i.profundidade, i.altura,
         i.bico, i.materiais, i.obs, i.cadastro,
         v.id AS voluntarioId, v.nome AS voluntarioNome, v.cidade AS voluntarioCidade,
         v.status AS voluntarioStatus, v.email AS voluntarioEmail, v.telefone AS voluntarioTelefone
    FROM impressoras i
    JOIN voluntarios v ON v.id = i.voluntario_id
`;

function listarImpressoras() {
  return db.prepare(`${CONSULTA_IMPRESSORAS} ORDER BY i.cadastro DESC`).all();
}

function buscarImpressora(id) {
  return db.prepare(`${CONSULTA_IMPRESSORAS} WHERE i.id = ?`).get(id);
}

function removerImpressora(id) {
  db.prepare("DELETE FROM impressoras WHERE id = ?").run(id);
}

// ----- Consultas: Voluntários -----
// Regra de troca de status: status atual -> próximo status
const proximoStatusVoluntario = {
  Pendente: "Ativo",    // Aprovar
  Ativo: "Inativo",     // Desativar
  Inativo: "Ativo",     // Reativar
};

// "impressoras" é montado a partir da tabela de impressoras (ex.: "Ender 3 V2, Bambu Lab P1S"),
// assim, se uma impressora for removida, a lista de voluntários já mostra certo.
const CAMPOS_VOLUNTARIO = `
  id, nome, cidade, status,
  (SELECT GROUP_CONCAT(modelo, ', ') FROM impressoras i WHERE i.voluntario_id = voluntarios.id) AS impressoras,
  materiais, entregues, em_producao AS emProducao, email, telefone, cadastro
`;

function listarVoluntarios() {
  return db.prepare(`SELECT ${CAMPOS_VOLUNTARIO} FROM voluntarios ORDER BY nome`).all();
}

function buscarVoluntario(id) {
  return db.prepare(`SELECT ${CAMPOS_VOLUNTARIO} FROM voluntarios WHERE id = ?`).get(id);
}

function atualizarStatusVoluntario(id, novoStatus) {
  db.prepare("UPDATE voluntarios SET status = ? WHERE id = ?").run(novoStatus, id);
  return buscarVoluntario(id);
}

// ----- Consultas: Pedidos Disponíveis -----
function listarDisponiveis() {
  return db.prepare("SELECT * FROM pedidos_disponiveis WHERE aceito_em IS NULL ORDER BY criado DESC").all();
}

function buscarDisponivel(id) {
  return db.prepare("SELECT * FROM pedidos_disponiveis WHERE id = ?").get(id);
}

function aceitarDisponivel(id, voluntarioId) {
  db.prepare("UPDATE pedidos_disponiveis SET aceito_em = ?, voluntario_id = ? WHERE id = ?")
    .run(hojeISO(), voluntarioId, id);
  return buscarDisponivel(id);
}

// ----- Consultas: Pedidos Aceitos -----
function listarPedidos() {
  return db.prepare("SELECT * FROM pedidos ORDER BY aceito_em DESC").all();
}

function buscarPedido(id) {
  return db.prepare("SELECT * FROM pedidos WHERE id = ?").get(id);
}

function atualizarStatusPedido(id, novoStatus) {
  db.prepare("UPDATE pedidos SET status = ? WHERE id = ?").run(novoStatus, id);
  return buscarPedido(id);
}

// ----- Consultas: Em Produção -----
function listarProducao() {
  // mais urgentes primeiro
  return db.prepare("SELECT * FROM producao ORDER BY entrega ASC").all();
}

function buscarPeca(id) {
  return db.prepare("SELECT * FROM producao WHERE id = ?").get(id);
}

function enviarPecaParaValidacao(id) {
  db.prepare(`
    UPDATE producao
       SET status = 'Aguardando validação', enviado = ?, progresso = 100
     WHERE id = ?
  `).run(hojeISO(), id);
  return buscarPeca(id);
}

// =====================================================
// 2. API (rotas)
// =====================================================
const app = express();
app.use(cors());          // deixa o frontend (ex.: Live Server) chamar a API
app.use(express.json());

// ----- Cadastro de demanda -----
//   GET   /api/proteses   -> próteses cadastradas (modelos para preencher o formulário)
//   GET   /api/demandas   -> demandas publicadas
//   POST  /api/demandas   -> publica uma nova demanda
app.get("/api/proteses", (req, res) => {
  res.json(listarProteses());
});

app.get("/api/demandas", (req, res) => {
  res.json(listarDemandas());
});

app.post("/api/demandas", (req, res) => {
  const demanda = req.body || {};
  const erros = validarDemanda(demanda);
  if (erros.length) return res.status(400).json({ erro: erros[0], erros });

  res.status(201).json(salvarDemanda(demanda));
});

// ----- Impressoras cadastradas -----
//   GET    /api/impressoras      -> todas as impressoras, com o voluntário dono
//   GET    /api/impressoras/:id  -> uma impressora
//   DELETE /api/impressoras/:id  -> remove a impressora
app.get("/api/impressoras", (req, res) => {
  res.json(listarImpressoras());
});

app.get("/api/impressoras/:id", (req, res) => {
  const impressora = buscarImpressora(Number(req.params.id));
  if (!impressora) return res.status(404).json({ erro: "Impressora não encontrada." });
  res.json(impressora);
});

app.delete("/api/impressoras/:id", (req, res) => {
  const id = Number(req.params.id);
  const impressora = buscarImpressora(id);
  if (!impressora) return res.status(404).json({ erro: "Impressora não encontrada." });

  removerImpressora(id);
  res.json({ removida: impressora });
});

// ----- Voluntários -----
//   GET   /api/voluntarios         -> lista todos os voluntários
//   GET   /api/voluntarios/:id         -> um voluntário
//   PATCH /api/voluntarios/:id/status  -> aprova, desativa ou reativa
app.get("/api/voluntarios", (req, res) => {
  res.json(listarVoluntarios());
});

app.get("/api/voluntarios/:id", (req, res) => {
  const voluntario = buscarVoluntario(Number(req.params.id));
  if (!voluntario) return res.status(404).json({ erro: "Voluntário não encontrado." });
  res.json(voluntario);
});

app.patch("/api/voluntarios/:id/status", (req, res) => {
  const id = Number(req.params.id);
  const voluntario = buscarVoluntario(id);
  if (!voluntario) return res.status(404).json({ erro: "Voluntário não encontrado." });

  const novoStatus = proximoStatusVoluntario[voluntario.status];
  res.json(atualizarStatusVoluntario(id, novoStatus));
});

// ----- Pedidos Disponíveis -----
//   GET   /api/disponiveis            -> pedidos que ninguém aceitou ainda
//   PATCH /api/disponiveis/:id/aceitar  -> marca o pedido como aceito
app.get("/api/disponiveis", (req, res) => {
  res.json(listarDisponiveis());
});

app.patch("/api/disponiveis/:id/aceitar", (req, res) => {
  const id = Number(req.params.id);
  const pedido = buscarDisponivel(id);

  if (!pedido) return res.status(404).json({ erro: "Pedido não encontrado." });
  if (pedido.aceito_em) {
    return res.status(409).json({ erro: `O pedido #${id} já foi aceito.` });
  }

  // Quando tiver login, troque o 1 pelo id do voluntário logado
  res.json(aceitarDisponivel(id, 1));
});

// ----- Pedidos Aceitos -----
//   GET   /api/pedidos            -> lista todos os pedidos aceitos
//   GET   /api/pedidos/:id          -> um pedido
//   PATCH /api/pedidos/:id/aceitar  -> Pendente => Em produção
app.get("/api/pedidos", (req, res) => {
  res.json(listarPedidos());
});

app.get("/api/pedidos/:id", (req, res) => {
  const pedido = buscarPedido(Number(req.params.id));
  if (!pedido) return res.status(404).json({ erro: "Pedido não encontrado." });
  res.json(pedido);
});

app.patch("/api/pedidos/:id/aceitar", (req, res) => {
  const id = Number(req.params.id);
  const pedido = buscarPedido(id);

  if (!pedido) return res.status(404).json({ erro: "Pedido não encontrado." });
  if (pedido.status !== "Pendente") {
    return res.status(409).json({ erro: `O pedido #${id} não está pendente.` });
  }

  res.json(atualizarStatusPedido(id, "Em produção"));
});

// ----- Em Produção -----
//   GET   /api/producao              -> lista todas as peças
//   GET   /api/producao/:id          -> uma peça
//   PATCH /api/producao/:id/enviar   -> Em produção => Aguardando validação
app.get("/api/producao", (req, res) => {
  res.json(listarProducao());
});

app.get("/api/producao/:id", (req, res) => {
  const peca = buscarPeca(Number(req.params.id));
  if (!peca) return res.status(404).json({ erro: "Peça não encontrada." });
  res.json(peca);
});

app.patch("/api/producao/:id/enviar", (req, res) => {
  const id = Number(req.params.id);
  const peca = buscarPeca(id);

  if (!peca) return res.status(404).json({ erro: "Peça não encontrada." });
  if (peca.status !== "Em produção") {
    return res.status(409).json({ erro: `A peça #${id} não está em produção.` });
  }

  res.json(enviarPecaParaValidacao(id));
});

// =====================================================
// 3. SERVIDOR
// Também serve o frontend, por exemplo:
// http://localhost:3000/frontend/VOLUNTARIO/PEDIDOS_DISPONIVEIS/tela_pedidos_disponiveis.html
// http://localhost:3000/frontend/VOLUNTARIO/PEDIDOS_ACEITOS/tela_pedidos_aceitos.html
// http://localhost:3000/frontend/VOLUNTARIO/EM_PRODUÇAO/tela_em_producao.html
// =====================================================
app.use(express.static(path.join(__dirname, "..")));

app.listen(PORTA, () => {
  console.log(`API rodando em http://localhost:${PORTA}/api`);
});