const mongoose = require('mongoose');

const fichaTecnicaImpressoraSchema = new mongoose.Schema({
    voluntario_id: { 
        type: Number, 
        required: [true, 'O ID do voluntário é obrigatório'] 
    },
    nome_da_impressora: { 
        type: String, 
        required: [true, 'O nome da impressora é obrigatório'], 
        trim: true 
    },
    marca_da_impressora: { 
        type: String, 
        required: [true, 'A marca da impressora é obrigatória'], 
        trim: true 
    },
    modelo_da_impressora: { 
        type: String, 
        required: [true, 'O modelo da impressora é obrigatório'], 
        trim: true 
    },
    tecnologia_da_impressora: {
        type: String,
        required: [true, 'A tecnologia da impressora é obrigatória'],
        trim: true,
        uppercase: true
    },
    volume_impressao: {
        largura_mm: { type: Number, required: true },
        profundidade_mm: { type: Number, required: true },
        altura_mm: { type: Number, required: true }
    },
    materiais_compativeis: [{ 
        type: String, 
        trim: true, 
        uppercase: true
    }],
    diametro_bico_mm: { type: Number, required: true },
    diametro_filamento_mm: { type: Number, required: true },
    localizacao: {
        endereco: {
            logradouro: { type: String, required: true, trim: true },
            numero: { type: String, required: true, trim: true },
            cep: { type: String, required: true, trim: true }
        }
    },
    informacoes_adicionais: {
        foto_impressora_url: { type: String },
        observacoes: { type: String },
        experiencia_voluntario: { type: String },
        materiais_atuais: [{ type: String }]
    },
    data_cadastro: { type: Date, default: Date.now }
});

module.exports = mongoose.model('FichaTecnicaImpressora', fichaTecnicaImpressoraSchema, 'fichas_tecnicas_impressoras');