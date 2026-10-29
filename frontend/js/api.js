/* =========================================================
   api.js — TODA a comunicação com o backend fica aqui.
   As telas só chamam AACD.api.<função>() e recebem os dados.
   Troque API_URL se o backend rodar em outra porta/servidor.
   ========================================================= */
"use strict";

AACD.api = (() => {
  // Usa o mesmo nome de máquina da página (localhost ou 127.0.0.1). Assim o cookie
  // de login é aceito pelo navegador, que trata localhost e 127.0.0.1 como sites diferentes.
  const HOST = location.hostname || "localhost";
  const API_URL = `http://${HOST}:3000/api`;

  // Faz a requisição, converte a resposta em JSON e transforma
  // respostas de erro (4xx/5xx) em exceções com a mensagem do servidor.
  async function requisitar(caminho, { metodo = "GET", corpo, comCookie = false, erroPadrao } = {}) {
    const opcoes = { method: metodo, headers: {} };
    if (corpo instanceof FormData) {
      opcoes.body = corpo; // o navegador define o Content-Type (multipart) sozinho
    } else if (corpo !== undefined) {
      opcoes.headers["Content-Type"] = "application/json";
      opcoes.body = JSON.stringify(corpo);
    }
    if (comCookie) opcoes.credentials = "include";

    let resposta;
    try {
      resposta = await fetch(`${API_URL}${caminho}`, opcoes);
    } catch {
      throw new Error("Não foi possível conectar ao servidor. Verifique se o backend está rodando.");
    }

    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.erro || erroPadrao || "Erro ao comunicar com o servidor.");
    return dados;
  }

  return {
    // ----- Autenticação -----
    login: (email, senha, perfil) =>
      requisitar("/auth/login", { metodo: "POST", corpo: { email, senha, perfil }, comCookie: true, erroPadrao: "Não foi possível fazer login." }),
    // Usuário logado, lido do banco pelo servidor: { id_usuario, nome, email, perfil, ... }
    usuarioLogado: () =>
      requisitar("/auth/me", { comCookie: true, erroPadrao: "Sessão inválida." }).then(r => r.usuario),
    logout: () =>
      requisitar("/auth/logout", { metodo: "POST", comCookie: true }),

    // ----- Cadastro de voluntário -----
    cadastrarVoluntario: (dados) =>
      requisitar("/voluntarios", {
        metodo: "POST",
        erroPadrao: "Erro ao cadastrar voluntário.",
        corpo: {
          nome: dados.nome,
          email: dados.email,
          telefone: dados.telefone,
          senha: dados.senha,
          confirmar_senha: dados.confirmarSenha,
          tipo_voluntario: dados.tipo_voluntario,
          cpf_cnpj: dados.documento.replace(/\D/g, ""),
          razao_social: dados.tipo_voluntario === "Pessoa fisica" ? null : dados.nome,
          cep: dados.cep,
          logradouro: dados.rua,
          numero: dados.numero,
          complemento: dados.complemento,
          bairro: dados.bairro,
          cidade: dados.cidade,
          estado: dados.uf
        }
      }),

    // ----- CEP (ViaCEP, serviço externo) -----
    async buscarCep(cep) {
      const resposta = await fetch(`https://viacep.com.br/ws/${encodeURIComponent(cep)}/json/`);
      if (!resposta.ok) throw new Error("Falha na consulta do CEP.");
      const dados = await resposta.json();
      if (dados.erro) return null;
      return { rua: dados.logradouro || "", bairro: dados.bairro || "", cidade: dados.localidade || "", uf: dados.uf || "" };
    },

    // ----- Voluntário: pedidos disponíveis -----
    // Formato: { id, peca, material, quantidade, prazo, criado, prioridade, tempo, obs }
    listarDisponiveis: () => requisitar("/disponiveis", {
    comCookie: true,
    erroPadrao: "Não foi possível carregar os pedidos."
    }),
    // Consulta somente impressoras pertencentes ao voluntário logado.
    listarMinhasImpressoras: () => requisitar("/impressoras", {
      comCookie: true,
      erroPadrao: "Não foi possível carregar suas impressoras."
    }),
    // O backend ainda precisa implementar PATCH /api/disponiveis/:id/aceitar.
    aceitarDisponivel: (id, idImpressoraMongo) => requisitar(`/disponiveis/${encodeURIComponent(id)}/aceitar`, {
      metodo: "PATCH",
      corpo: { id_impressora_mongo: idImpressoraMongo },
      comCookie: true,
      erroPadrao: "Não foi possível aceitar o pedido."
    }),

    // ----- Voluntário: pedidos aceitos e recusados -----
    // Formato: { id, produto, categoria, status, aceito_em, material, prazo, obs }
    listarPedidos: () => requisitar("/pedidos", { erroPadrao: "Não foi possível carregar os pedidos." }),
    aceitarPedido: (id) => requisitar(`/pedidos/${id}/aceitar`, { metodo: "PATCH", erroPadrao: "Não foi possível aceitar o pedido." }),
    recusarPedido: (id) => requisitar(`/pedidos/${id}/recusar`, { metodo: "PATCH", erroPadrao: "Não foi possível recusar o pedido." }),

    // ----- Voluntário: produção -----
    // Formato: { id, paciente, peca, status, entrega, enviado, concluido, material, impressora, progresso, obs }
    listarProducao: () => requisitar("/status_producao", { comCookie: true, erroPadrao: "Não foi possível carregar as peças." }),
  alterarStatusProducao: (id, status) => requisitar(`/status_producao/${encodeURIComponent(id)}/status`, {
  metodo: "PATCH", corpo: { status }, comCookie: true,
  erroPadrao: "Não foi possível alterar o status."
}),

    // ----- Funcionário: voluntários -----
    // Formato: { id, nome, email, telefone, tipo, documento, razaoSocial, endereco, cep,
    //            cidade, estado, status, impressoras, cadastro }
    listarVoluntarios: () => requisitar("/voluntarios", { comCookie: true, erroPadrao: "Não foi possível carregar os voluntários." }),
    aceitarVoluntario: (id) => requisitar(`/voluntarios/${encodeURIComponent(id)}/aceitar`, {
      metodo: "PATCH", comCookie: true,
      erroPadrao: "Não foi possível aceitar o voluntário."
    }),
    removerVoluntario: (id) =>requisitar(`/voluntarios/${encodeURIComponent(id)}`, {
      metodo: "DELETE", comCookie: true,
      erroPadrao: "Não foi possível remover o voluntário."
    }),

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
    // ----- Voluntário: cadastrar impressora -----
    cadastrarImpressora: (dados) => requisitar("/impressoras", {
      metodo: "POST", corpo: dados, comCookie: true,
      erroPadrao: "Não foi possível cadastrar a impressora."
    }),

    // ----- Voluntário: lista de impressoras cadastradas -----
    // Formato: { id, nome, marca, modelo, tecnologia, bico, largura, profundidade, altura,
    //            diametroFilamento, tempBico, materiais, cidade, estado, status, obs,
    //            cadastro, atualizacao, voluntarioNome, minha }
    listarImpressorasVoluntario: async () => {
      const impressoras = await requisitar("/voluntario/impressoras", {
        comCookie: true,
        erroPadrao: "Não foi possível carregar as impressoras."
      });
      return impressoras.map(i => ({
        id: i._id,
        nome: i.nome_da_impressora || "",
        marca: i.marca_da_impressora || "",
        modelo: i.modelo_da_impressora || "",
        tecnologia: i.tecnologia_da_impressora || "",
        bico: i.diametro_bico_mm ?? null,
        largura: i.volume_impressao?.largura_mm ?? null,
        profundidade: i.volume_impressao?.profundidade_mm ?? null,
        altura: i.volume_impressao?.altura_mm ?? null,
        diametroFilamento: i.diametro_filamento_mm ?? null,
        tempBico: i.temperatura_maxima_bico ?? null,
        materiais: (i.filamentos_compativeis || []).join(", "),
        cidade: i.localizacao?.endereco?.cidade || "",
        estado: i.localizacao?.endereco?.estado || "",
        status: i.status || "",
        obs: i.observacoes || "",
        cadastro: i.data_cadastro || "",
        atualizacao: i.data_atualizacao || "",
        voluntarioNome: i.voluntarioNome || `Voluntário #${i.id_voluntario}`,
        minha: Boolean(i.minha)
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
    id: i._id,
    modelo: i.modelo_da_impressora || "",
    tecnologia: i.tecnologia_da_impressora || "",
    bico: i.diametro_bico_mm ?? null,

    largura: i.volume_impressao?.largura_mm ?? null,
    profundidade: i.volume_impressao?.profundidade_mm ?? null,
    altura: i.volume_impressao?.altura_mm ?? null,

    materiais: (i.filamentos_compativeis || []).join(", "),
    obs: i.observacoes || "",
    cadastro: i.data_cadastro || "",

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
  };
})();
