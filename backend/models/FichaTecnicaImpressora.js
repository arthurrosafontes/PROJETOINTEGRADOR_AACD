const mongoose = require('mongoose');

const fichaTecnicaImpressoraSchema = new mongoose.Schema({
    voluntario_id: { type: Number, required: true },
    modelo_da_impressora: { type: String, required: true },
    
    tipo_impressao: {
        type: String,
        required: true,
    },

    volume_impressao: {
        largura_mm: { type: Number, required: true },
        profundidade_mm: { type: Number, required: true },
        altura_mm: { type: Number, required: true }
    },

    materiais_compativeis: [{
        type: String,
    }],

    diametro_bico_mm: { type: Number, required: true },
    diametro_filamento_mm: { type: Number, required: true },

    capacidade_disponibilidade: {
        horas_semanais: { type: Number },
        capacidade_producao_estimada: { type: String },
        dias_disponiveis: [{ type: String }],
        tempo_medio_por_impressao_horas: { type: Number }
    },

    localizacao: {
        endereco: {
            logradouro: {
                type: String,
                required: [true, 'O logradouro é obrigatório'],
                trim: true
            },
            numero: {
                type: String,
                required: [true, 'O número é obrigatório'],
                trim: true
            },
            cep: {
                type: String,
                required: [true, 'O CEP é obrigatório'],
                trim: true
            }
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