"use strict";

(() => {
  const { requisitar } = AACD.transporteApi;

  function formatarImpressora(impressora) {
    const volume = impressora.volume_impressao;
    return {
      id: impressora._id,
      modelo: impressora.modelo_da_impressora || "",
      tecnologia: impressora.tecnologia_da_impressora || "",
      bico: impressora.diametro_bico_mm ?? null,
      largura: volume?.largura_mm ?? null,
      profundidade: volume?.profundidade_mm ?? null,
      altura: volume?.altura_mm ?? null,
      materiais: (impressora.filamentos_compativeis || []).join(", "),
      obs: impressora.observacoes || "",
      cadastro: impressora.data_cadastro || ""
    };
  }

  Object.assign(AACD.api, {
    // Consulta somente impressoras pertencentes ao voluntário logado.
    listarMinhasImpressoras: () => requisitar("/impressoras", {
      comCookie: true,
      erroPadrao: "Não foi possível carregar suas impressoras."
    }),
    // ----- Voluntário: cadastrar impressora -----
    cadastrarImpressora: (dados) => requisitar("/impressoras", {
      metodo: "POST", corpo: dados, comCookie: true,
      erroPadrao: "Não foi possível cadastrar a impressora."
    }),

    // ----- Voluntário: lista das impressoras que ELE cadastrou -----
    // Formato: { id, nome, marca, modelo, tecnologia, bico, largura, profundidade, altura,
    //            diametroFilamento, tempBico, materiais, cidade, estado, status, obs,
    //            cadastro, atualizacao }
    listarImpressorasVoluntario: async () => {
      const impressoras = await requisitar("/impressoras", {
        comCookie: true,
        erroPadrao: "Não foi possível carregar as impressoras."
      });
      return impressoras.map(i => ({
        ...formatarImpressora(i),
        nome: i.nome_da_impressora || "",
        marca: i.marca_da_impressora || "",
        diametroFilamento: i.diametro_filamento_mm ?? null,
        tempBico: i.temperatura_maxima_bico ?? null,
        cidade: i.localizacao?.endereco?.cidade || "",
        estado: i.localizacao?.endereco?.estado || "",
        status: i.status || "",
        atualizacao: i.data_atualizacao || ""
      }));
    },
    // Só o dono do cadastro consegue editar (o servidor responde 403 para os demais)
    editarMinhaImpressora: (id, dados) => requisitar(`/impressoras/${encodeURIComponent(id)}`, {
      metodo: "PUT", corpo: dados, comCookie: true,
      erroPadrao: "Não foi possível salvar as alterações."
    }),

    // ----- Funcionário: impressoras -----
    // Formato: { id, modelo, tecnologia, bico, largura, profundidade, altura, materiais, obs,
    //            cadastro, voluntarioId, voluntarioNome, voluntarioCidade, voluntarioStatus,
    //            voluntarioEmail, voluntarioTelefone }
    listarImpressoras: async () => {
      const impressoras = await requisitar("/funcionario/impressoras", {
        comCookie: true,
        erroPadrao: "Não foi possível carregar as impressoras."
      });

      return impressoras.map(i => ({
        ...formatarImpressora(i),
        voluntarioId: i.id_voluntario,
        voluntarioNome: i.voluntarioNome || `Voluntário #${i.id_voluntario}`,
        voluntarioStatus: i.voluntarioStatus || "",
        voluntarioEmail: i.voluntarioEmail || "",
        voluntarioTelefone: i.voluntarioTelefone || ""
      }));
    },
    atualizarImpressora: (id, campos) => requisitar(`/funcionario/impressoras/${encodeURIComponent(id)}`, {
      metodo: "PUT", corpo: campos, comCookie: true,
      erroPadrao: "Não foi possível salvar as alterações."
    }),
    removerImpressora: (id) => requisitar(`/funcionario/impressoras/${encodeURIComponent(id)}`, {
      metodo: "DELETE", comCookie: true,
      erroPadrao: "Não foi possível remover a impressora."
    })
  });
})();
