// =====================================================
// API do HUB AACD
//   GET  /api/proteses  -> próteses/órteses ativas do banco (tabela "protese")
//   POST /api/demandas  -> recebe a demanda publicada pela tela "Nova Demanda"
// Para rodar:  npm install  ->  copiar .env.example para .env  ->  npm start
// =====================================================
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");

const app = express();
app.use(cors());          // permite o front (outra porta / Live Server) chamar a API
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = pool;

// O ENUM do banco não tem acento; a tela usa "Prótese" / "Órtese"
const TIPOS = { Protese: "Prótese", Ortese: "Órtese" };

// Converte uma linha da tabela "protese" no formato que a tela espera.
// DECIMAL chega do MySQL como texto ("85.00"), então vira número aqui.
function paraTela(linha) {
  const num = v => (v === null || v === undefined ? null : Number(v));
  return {
    id: String(linha.id_protese),
    codigo: linha.codigo_interno,
    nome: linha.nome,
    tipo: TIPOS[linha.tipo] || linha.tipo,
    regiao: linha.regiao_corpo,
    filamento: linha.material_padrao,   // o banco guarda o material padrão
    largura: num(linha.largura_mm),
    profundidade: num(linha.profundidade_mm),
    altura: num(linha.altura_mm),
    // A tabela ainda não tem diâmetro do bico nem tempo de impressão:
    bico: null,
    horas: null,
    minutos: null,
  };
}

// ----- Próteses cadastradas -----
app.get("/api/proteses", async (req, res) => {
  try {
    const [linhas] = await pool.query(
      `SELECT id_protese, codigo_interno, nome, tipo, regiao_corpo,
              material_padrao, largura_mm, altura_mm, profundidade_mm
         FROM protese
        WHERE status_protese = 'Ativa'
        ORDER BY nome`
    );
    res.json(linhas.map(paraTela));
  } catch (erro) {
    console.error("Erro ao buscar próteses:", erro.message);
    res.status(500).json({ erro: "Não foi possível carregar as próteses." });
  }
});

// ----- Demandas -----
// ATENÇÃO: ainda NÃO grava no MySQL (não tenho a tabela de demanda).
// Por enquanto fica só na memória do servidor e some quando ele reinicia.
// Para gravar de verdade, troque o trecho "demandasEmMemoria" por um INSERT na sua tabela.
const demandasEmMemoria = [];

app.post("/api/demandas", (req, res) => {
  const d = req.body || {};
  const imp = d.impressao || {};
  const ent = d.entrega || {};

  const faltando = [];
  if (!d.nome) faltando.push("nome");
  if (!(Number(d.quantidade) > 0)) faltando.push("quantidade");
  if (!imp.filamento) faltando.push("filamento");
  if (!(Number(imp.tempoEstimadoMin) > 0)) faltando.push("tempo estimado");
  if (!ent.prazo) faltando.push("prazo");
  if (!ent.local) faltando.push("local de entrega");

  if (faltando.length) {
    return res.status(400).json({ erro: `Campos obrigatórios: ${faltando.join(", ")}.` });
  }

  const salva = { ...d, id: Date.now(), criado: new Date().toISOString().slice(0, 10) };
  demandasEmMemoria.push(salva);
  console.warn("⚠ Demanda recebida, mas ainda não gravada no banco:", salva.id);
  res.status(201).json(salva);
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => console.log(`API rodando em http://localhost:${PORT}`));