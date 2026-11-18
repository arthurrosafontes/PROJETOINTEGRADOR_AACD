"use strict";

(() => {
  const { requisitar, API_URL } = AACD.transporteApi;

  Object.assign(AACD.api, {
    // ----- Voluntário: pedidos disponíveis -----
    // Formato: { id, peca, material, quantidade, prazo, criado, prioridade, tempo, obs }
    listarDisponiveis: () => requisitar("/disponiveis", {
      comCookie: true,
      erroPadrao: "Não foi possível carregar os pedidos."
    }),
    aceitarDisponivel: (id, idImpressora, doacaoMaterial, materialAacd) =>
      requisitar(`/disponiveis/${encodeURIComponent(id)}/aceitar`, {
        metodo: "PATCH",
        corpo: {
          id_impressora_mongo: idImpressora,
          doacao_material: doacaoMaterial, materialAacd
        },
        comCookie: true,
        erroPadrao: "Não foi possível aceitar o pedido."
      }),
    // ----- Voluntário: pedidos aceitos e recusados -----
    // Formato: { id, produto, categoria, status, aceito_em, material, prazo, obs }
    unidadesMaterial: id => requisitar('/pedidos/material/unidades/' + encodeURIComponent(id), { comCookie: true, erroPadrao: 'Não foi possível calcular as unidades.' }),
    unidadesRetirada: () => requisitar('/matchmaking/unidades', { comCookie: true }),
    prepararMaterial: (id, corpo) => requisitar('/pedidos/' + encodeURIComponent(id) + '/material/preparar', { metodo: 'PATCH', comCookie: true, corpo, erroPadrao: 'Não foi possível preparar o material.' }),
    receberMaterial: id => requisitar('/pedidos/' + encodeURIComponent(id) + '/material/receber', { metodo: 'PATCH', comCookie: true, corpo: {}, erroPadrao: 'Não foi possível confirmar o recebimento.' }),
    listarPedidos: () => requisitar("/pedidos", {
      comCookie: true,
      erroPadrao: "Não foi possível carregar os pedidos."
    }),
    receberPedido: (id, corpo) => requisitar(`/pedidos/${encodeURIComponent(id)}/receber`, {
      metodo: "PATCH", comCookie: true, corpo
    }),
    urlFotoRecebimento: id => `${API_URL}/pedidos/${encodeURIComponent(id)}/recebimento/foto`,
    registrarEnvio: (id, corpo) => requisitar(`/pedidos/${encodeURIComponent(id)}/envio`, {
      metodo: "PATCH", comCookie: true, corpo
    }),
    finalizarImpressao: (id, corpo) => requisitar(`/pedidos/${encodeURIComponent(id)}/finalizar`, {
      metodo: "PATCH", comCookie: true, corpo
    }),
    urlFotoProducao: id => `${API_URL}/pedidos/fotos/${encodeURIComponent(id)}`,
    iniciarProducao: (id) =>
      requisitar(`/pedidos/${encodeURIComponent(id)}/iniciar`, {
        metodo: "PATCH",
        comCookie: true,
        erroPadrao: "Não foi possível iniciar a produção."
      }),
    baixarArquivo3d: async (id) => {
      const resposta = await fetch(
        `${API_URL}/pedidos/${encodeURIComponent(id)}/arquivo-3d`,
        { credentials: "include" }
      );

      if (!resposta.ok) {
        const dados = await resposta.json().catch(() => ({}));
        throw new Error(dados.erro || "Não foi possível baixar o arquivo 3D.");
      }

      const arquivo = await resposta.blob();
      const url = URL.createObjectURL(arquivo);

      const link = document.createElement("a");
      link.href = url;
      link.download = `pedido-${id}-arquivo-3d.3mf`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  });
})();
