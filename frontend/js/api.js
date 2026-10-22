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
    if (corpo !== undefined) {
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
    listarDisponiveis: () => requisitar("/disponiveis", { erroPadrao: "Não foi possível carregar os pedidos." }),
    aceitarDisponivel: (id) => requisitar(`/disponiveis/${id}/aceitar`, { metodo: "PATCH", erroPadrao: "Não foi possível aceitar o pedido." }),

    // ----- Voluntário: pedidos aceitos e recusados -----
    // Formato: { id, produto, categoria, status, aceito_em, material, prazo, obs }
    listarPedidos: () => requisitar("/pedidos", { erroPadrao: "Não foi possível carregar os pedidos." }),
    aceitarPedido: (id) => requisitar(`/pedidos/${id}/aceitar`, { metodo: "PATCH", erroPadrao: "Não foi possível aceitar o pedido." }),
    recusarPedido: (id) => requisitar(`/pedidos/${id}/recusar`, { metodo: "PATCH", erroPadrao: "Não foi possível recusar o pedido." }),

    // ----- Voluntário: produção -----
    // Formato: { id, paciente, peca, status, entrega, enviado, concluido, material, impressora, progresso, obs }
    listarProducao: () => requisitar("/producao", { erroPadrao: "Não foi possível carregar as peças." }),
    enviarParaValidacao: (id) => requisitar(`/producao/${id}/enviar`, { metodo: "PATCH", erroPadrao: "Não foi possível enviar a peça." }),

    // ----- Funcionário: voluntários -----
    // Formato: { id, nome, cidade, status, impressoras, materiais, entregues, emProducao, email, telefone, cadastro }
    listarVoluntarios: () => requisitar("/voluntarios", { erroPadrao: "Não foi possível carregar os voluntários." }),
    mudarStatusVoluntario: (id) => requisitar(`/voluntarios/${id}/status`, { metodo: "PATCH", erroPadrao: "Não foi possível mudar o status." }),

    // ----- Funcionário: demandas e próteses -----
    listarProteses: () => requisitar("/proteses", { erroPadrao: "Não foi possível carregar as próteses." }),
    publicarDemanda: (demanda) => requisitar("/demandas", { metodo: "POST", corpo: demanda, erroPadrao: "Não foi possível publicar a demanda." }),

    // ----- Funcionário: impressoras -----
    // Formato: { id, modelo, tecnologia, bico, largura, profundidade, altura, materiais, obs,
    //            cadastro, voluntarioId, voluntarioNome, voluntarioCidade, voluntarioStatus,
    //            voluntarioEmail, voluntarioTelefone }
    listarImpressoras: () => requisitar("/impressoras", { erroPadrao: "Não foi possível carregar as impressoras." }),
    atualizarImpressora: (id, campos) => requisitar(`/impressoras/${id}`, { metodo: "PUT", corpo: campos, erroPadrao: "Não foi possível salvar as alterações." }),
    removerImpressora: (id) => requisitar(`/impressoras/${id}`, { metodo: "DELETE", erroPadrao: "Não foi possível remover a impressora." })
  };
})();
