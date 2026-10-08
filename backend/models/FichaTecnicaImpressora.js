const mongoose = require('mongoose');

const fichaTecnicaImpressoraSchema = new mongoose.Schema({
    voluntario_id: { type: Number, required: true },
    modelo_da_impressora: { type: String, required: true },
    
    tecnologia: {
        type: String,
        required: true,
        enum: ['FDM/FFF', 'SLA', 'SLS', 'Outra']
    },

    volume_impressao: {
        largura_mm: { type: Number, required: true },
        profundidade_mm: { type: Number, required: true },
        altura_mm: { type: Number, required: true }
    },

    materiais_compativeis: [{
        type: String,
        enum: ['PLA', 'PETG', 'ABS', 'TPU', 'Nylon', 'ASA', 'Outros']
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
        cidade: { type: String, required: true },
        estado: { type: String, required: true },
        cep_regiao: { type: String },
        forma_entrega: {
            type: String,
            enum: ['Retirada', 'Envio', 'Ambos'],
            required: true
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