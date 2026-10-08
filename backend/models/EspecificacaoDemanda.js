const mongoose = require('mongoose');

const especificacaoDemandaSchema = new mongoose.Schema({
    pedidoId_mysql: { type: Number, required: true },
    titulo_peca: { type: String, required: true },
    versao_ficha_tecnica: { type: String, default: '1.0' },

    parametros_tecnicos: {
        altura_camada_mm: { type: Number, required: true },
        infill_percentual: { type: Number, required: true },
        necessita_suporte: { type: Boolean, required: true },
        orientacao_recomendada: { type: String, required: true },
        materiais_recomendados: [{ type: String }]
    },

    instrucoes_especificas: { type: String },
    observacoes_tecnicas: { type: String },
    arquivos_stl: [{ type: String }],
    informacoes_adicionais: { type: mongoose.Schema.Types.Mixed },

    data_criacao: { type: Date, default: Date.now }
});

module.exports = mongoose.model('EspecificacaoDemanda', especificacaoDemandaSchema, 'especificacoes_demandas');