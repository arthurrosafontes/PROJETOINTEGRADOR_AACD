"use strict";

(() => {
  const { requisitar, API_URL } = AACD.transporteApi;

  Object.assign(AACD.api, {
    preferenciasNotificacoes: () => requisitar('/notificacoes/preferencias', { comCookie: true }),
    salvarNotificacoes: corpo => requisitar('/notificacoes/preferencias', { metodo: 'PUT', corpo, comCookie: true }),
    listarNotificacoes: () => requisitar('/notificacoes', { comCookie: true }),
    confirmarNotificacao: id => requisitar('/notificacoes/' + encodeURIComponent(id) + '/exibida', { metodo: 'PATCH', comCookie: true }),

    // ----- Autenticação -----
    login: (email, senha, perfil) =>
      requisitar("/auth/login", { metodo: "POST", corpo: { email, senha, perfil }, comCookie: true, erroPadrao: "Não foi possível fazer login." }),
    solicitarCodigo: email =>
      requisitar("/auth/recuperacao-senha/solicitar", { metodo: "POST", corpo: { email } }),
    validarCodigo: (email, codigo) =>
      requisitar("/auth/recuperacao-senha/validar", { metodo: "POST", corpo: { email, codigo } }),
    redefinirSenha: (email, autorizacao, senha) =>
      requisitar("/auth/recuperacao-senha/redefinir", { metodo: "POST", corpo: { email, autorizacao, senha } }),
    // Usuário logado, lido do banco pelo servidor: { id_usuario, nome, email, perfil, ... }
    usuarioLogado: () =>
      requisitar("/auth/me", { comCookie: true, erroPadrao: "Sessão inválida." }).then(r => r.usuario),
    logout: () =>
      requisitar("/auth/logout", { metodo: "POST", comCookie: true }),

    // ----- Meu perfil -----
    excluirConta: senha => requisitar("/auth/conta", { metodo: "DELETE", corpo: { senha }, comCookie: true }),
    meuPerfil: () =>
      requisitar("/auth/perfil", { comCookie: true, erroPadrao: "Não foi possível carregar o perfil." }),
    // O "?t=" muda a cada chamada para o navegador não mostrar a foto antiga guardada
    urlFotoPerfil: () => `${API_URL}/auth/perfil/foto?t=${Date.now()}`,
    enviarFotoPerfil: (arquivo) => {
      const formulario = new FormData();
      formulario.append("foto", arquivo);
      return requisitar("/auth/perfil/foto", { metodo: "PUT", corpo: formulario, comCookie: true, erroPadrao: "Não foi possível enviar a foto." });
    },

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
          estado: dados.uf,
          aceitouTermos: dados.aceitouTermos === "sim",
          cientePrivacidade: dados.cientePrivacidade === "sim",
          versaoDocumentos: dados.versaoDocumentos
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
  });
})();
