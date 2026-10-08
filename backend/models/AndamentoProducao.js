const mongoose = require('mongoose');

const andamentoSchema = new mongoose.Schema({
    pedidoId_mysql: { type: Number, required: true },
    voluntario_id: { type: Number, required: true },
    data_conclusao: { type: Date, default: null },
    historico_eventos: [{
        data_hora: { type: Date, default: Date.now },
        status: { 
            type: String, 
            required: true,
            enum: [
                'Na Fila', 
                'Em Produção', 
                'Pós-Processamento', 
                'Pronto para Envio', 
                'Em Trânsito', 
                'Entregue', 
                'Pausado', 
                'Cancelado'
            ]
        },
        motivo_pausa: { type: String, default: null },
        foto_url: { type: String }
    }]
});

module.exports = mongoose.model('AndamentoProducao', andamentoSchema, 'andamento_producoes');