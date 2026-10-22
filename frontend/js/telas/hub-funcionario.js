/* =========================================================
   telas/hub-funcionario.js — boas-vindas com o nome do
   funcionário, lido do banco pela rota GET /api/auth/me
   ========================================================= */
"use strict";

(() => {
  const { $, sessao } = AACD.util;

  function mostrarNome(nome) {
    $("hub-func-nome").textContent = nome ? `, ${nome}` : "";
    if (nome) $("usuario-nome").textContent = nome; // nome também na barra do topo
  }

  AACD.telas["tela-hub-funcionario"] = {
    async aoEntrar() {
      // Mostra na hora o nome guardado no login; depois confirma com o banco
      const guardado = sessao.obter();
      mostrarNome(guardado && guardado.perfil === "funcionario" ? guardado.nome : "");

      try {
        const usuario = await AACD.api.usuarioLogado();
        if (usuario.perfil !== "funcionario") return mostrarNome("");
        sessao.salvar({ ...guardado, ...usuario });
        mostrarNome(usuario.nome);
      } catch {
        // Sem sessão válida ou servidor fora do ar: a mensagem fica sem o nome
        if (!guardado) mostrarNome("");
      }
    }
  };
})();
