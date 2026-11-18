const router = require('express').Router();
const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const pool = require('../config/mysql');
const { pastaProteses } = require('../config/caminhos');
const { somenteFuncionario } = require('../middleware/autenticacao');

// Cadastro de prótese pelo funcionário (tabela "protese" do MySQL)
const TIPOS_PROTESE = ['Prótese', 'Órtese', 'Componente'];
const MATERIAIS_PROTESE = ['PLA', 'PETG', 'TPU (flexível)', 'ABS', 'ASA', 'Nylon'];

// Upload do arquivo 3D da prótese (.stl, .obj ou .3mf, até 50 MB).
// Fica em uploads/proteses com nome gerado; a coluna arquivo_3d guarda esse caminho.
fs.mkdirSync(pastaProteses, { recursive: true });
const EXTENSOES_3D = ['.stl', '.obj', '.3mf'];
const uploadArquivo3d = multer({
  storage: multer.diskStorage({
    destination: pastaProteses,
    filename: (req, arquivo, cb) => {
      const extensao = path.extname(arquivo.originalname).toLowerCase();
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${extensao}`);
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter: (req, arquivo, cb) => {
    if (EXTENSOES_3D.includes(path.extname(arquivo.originalname).toLowerCase())) return cb(null, true);
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', arquivo.fieldname));
  }
}).single('arquivo_3d');

// Roda o multer e transforma erros de upload em resposta 400
function receberArquivo3d(req, res, next) {
  uploadArquivo3d(req, res, erro => {
    if (!erro) return next();
    const mensagem = erro.code === 'LIMIT_FILE_SIZE'
      ? 'O arquivo 3D deve ter no máximo 50 MB.'
      : 'Envie um único arquivo 3D .stl, .obj ou .3mf.';
    return res.status(400).json({ erro: mensagem });
  });
}

router.post('/api/funcionario/proteses', ...somenteFuncionario, receberArquivo3d, async (req, res) => {
  // Se o cadastro falhar, o arquivo enviado não deve ficar órfão na pasta
  const descartarArquivo = () => req.file && fs.promises.unlink(req.file.path).catch(() => {});
  const d = req.body;
  if (!d || typeof d !== 'object' || Array.isArray(d)) {
    return res.status(400).json({ erro: 'Dados da prótese inválidos.' });
  }

  // Texto opcional: vazio vira NULL; acima do limite da coluna é erro
  const texto = (campo, limite) => {
    const v = String(d[campo] ?? '').trim();
    if (limite && v.length > limite) throw new Error(`O campo ${campo} excede ${limite} caracteres.`);
    return v || null;
  };
  // Número opcional dentro do intervalo aceito pela coluna
  const numero = (campo, min, max, inteiro = false) => {
    if (d[campo] === null || d[campo] === undefined || d[campo] === '') return null;
    const n = Number(d[campo]);
    if (!Number.isFinite(n) || n < min || n > max || (inteiro && !Number.isInteger(n))) {
      throw new Error(`Valor inválido para ${campo}.`);
    }
    return n;
  };

  let valores;
  try {
    const nome = texto('nome', 150);
    if (!nome) throw new Error('Informe o nome da prótese.');
    if (!TIPOS_PROTESE.includes(d.tipo)) throw new Error('Tipo de prótese inválido.');
    const material = texto('material_recomendado', 100);
    if (material && !MATERIAIS_PROTESE.includes(material)) throw new Error('Material recomendado inválido.');

    valores = [
      nome, texto('codigo', 50), d.tipo, texto('regiao_corpo', 100), texto('descricao'),
      material,
      numero('largura', 0.01, 999999.99), numero('profundidade', 0.01, 999999.99), numero('altura', 0.01, 999999.99),
      req.file ? `uploads/proteses/${req.file.filename}` : null,
      numero('altura_camada', 0.01, 99.99), numero('infill', 0, 100, true),
      // Pode vir como booleano (JSON) ou texto "true"/"false" (multipart)
      d.necessita_suporte === true || d.necessita_suporte === 'true' ? 1 : 0,
      texto('orientacoes_impressao'), texto('observacoes'),
      texto('versao', 20), 'Inativa'
    ];
  } catch (erro) {
    descartarArquivo();
    return res.status(400).json({ erro: erro.message });
  }

  try {
    const [resultado] = await pool.execute(
      `INSERT INTO protese
        (nome, codigo, tipo, regiao_corpo, descricao, material_recomendado, largura, profundidade, altura,
         arquivo_3d, altura_camada, infill, necessita_suporte, orientacoes_impressao, observacoes, versao, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      valores
    );
    return res.status(201).json({ mensagem: 'Prótese cadastrada com sucesso!', id_protese: resultado.insertId });
  } catch (erro) {
    descartarArquivo();
    if (erro.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'Já existe uma prótese com esse código.' });
    console.error('Erro ao cadastrar prótese:', erro);
    return res.status(500).json({ erro: 'Não foi possível cadastrar a prótese.' });
  }
});

module.exports = router;
