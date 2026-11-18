"use strict";

(() => {
  const { requisitar } = AACD.transporteApi;

  Object.assign(AACD.api, {
    convidarMatchmaking: (id, impressoraId) => requisitar('/matchmaking/demandas/' + encodeURIComponent(id) + '/convites', {
      metodo: 'POST', corpo: { impressoraId }, comCookie: true
    }),
    listarUnidadesAACD: () => requisitar('/matchmaking/unidades', { comCookie: true, erroPadrao: 'Não foi possível carregar as unidades.' }),
    consultarMatchmaking: id => requisitar('/matchmaking/demandas/'+encodeURIComponent(id), { comCookie: true, erroPadrao: 'Não foi possível consultar a compatibilidade.' }),

    // ----- Funcionário: demandas e próteses -----
    listarProteses: () => requisitar("/funcionario/proteses", {
      comCookie: true,
      erroPadrao: "Não foi possível carregar as próteses."
    }),
    // Campos com os mesmos nomes das colunas da tabela "protese".
    // Vai como multipart para levar junto o arquivo 3D (opcional).
    cadastrarProtese: (dados, arquivo) => {
      const corpo = new FormData();
      Object.entries(dados).forEach(([chave, v]) => corpo.append(chave, v === null ? "" : String(v)));
      if (arquivo) corpo.append("arquivo_3d", arquivo);
      return requisitar("/funcionario/proteses", {
        metodo: "POST", corpo, comCookie: true,
        erroPadrao: "Não foi possível cadastrar a prótese."
      });
    },

    publicarDemanda: (demanda) => requisitar("/demandas", {
      metodo: "POST",
      corpo: demanda,
      comCookie: true,
      erroPadrao: "Não foi possível publicar a demanda."
    }),
    // Formato: { id, nome, protese, proteseCodigo, tipo, regiao, quantidade, material, bico,
    //            largura, profundidade, altura, tempoHoras, prioridade, prazo, status, cadastro,
    //            localEntrega, paciente, formaEntrega, responsavel, instrucoes, observacoes }
    listarDemandas: () => requisitar("/funcionario/demandas", {
      comCookie: true,
      erroPadrao: "Não foi possível carregar as demandas."
    }),
    listarPedidosDaDemanda: (idDemanda) =>
      requisitar(`/funcionario/demandas/${encodeURIComponent(idDemanda)}/pedidos`, {
        comCookie: true,
        erroPadrao: "Não foi possível consultar a doação de material."
      }),

    atualizarDemanda: (id, campos) => requisitar(`/funcionario/demandas/${encodeURIComponent(id)}`, {
      metodo: "PUT", corpo: campos, comCookie: true,
      erroPadrao: "Não foi possível salvar as alterações da demanda."
    }),
    
    adicionarObservacaoDemanda: (id, texto) => requisitar(`/funcionario/demandas/${encodeURIComponent(id)}/observacoes`, {
      metodo: "POST", corpo: { texto }, comCookie: true,
      erroPadrao: "Não foi possível adicionar a observação."
    }),
    cancelarDemanda: (id) => requisitar(`/funcionario/demandas/${encodeURIComponent(id)}/cancelar`, {
      metodo: "PATCH", comCookie: true,
      erroPadrao: "Não foi possível cancelar a demanda."
    }),
  });
})();
