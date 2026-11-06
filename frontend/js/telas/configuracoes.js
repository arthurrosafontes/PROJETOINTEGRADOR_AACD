/* =========================================================
   telas/configuracoes.js — tela de Configurações (voluntário e funcionário)
   ---------------------------------------------------------
   - Cada mudança é aplicada e salva na hora (sem botão "Salvar"),
     com o aviso "Salvo ✓" logo em seguida.
   - Sair e excluir conta pedem confirmação.
   ========================================================= */
"use strict";

(() => {
  const { $, mostrarToast, confirmar, sessao } = AACD.util;
  const prefs = AACD.preferencias;

  const VERSAO_APP = "1.0.0";                  // mesma do package.json
  const EMAIL_SUPORTE = "suporte@aacd.org.br"; // TODO: confirmar o e-mail oficial da equipe

  let form;

  // ===== Formulário <-> preferências =====
  function preencher(p) {
    for (const [chave, padrao] of Object.entries(prefs.PADRAO)) {
      const campo = form.elements[chave];
      if (!campo) continue;
      if (typeof padrao === "boolean") campo.checked = p[chave];
      else campo.value = p[chave]; // em grupos de rádio, marca a opção com esse valor
    }
  }

  function lerFormulario() {
    const p = {};
    for (const [chave, padrao] of Object.entries(prefs.PADRAO)) {
      const campo = form.elements[chave];
      p[chave] = typeof padrao === "boolean" ? campo.checked : (campo.value || padrao);
    }
    return p;
  }

  // Salva assim que algo muda e confirma na hora
  function salvarMudanca() {
    if (prefs.salvar(lerFormulario())) mostrarToast("Salvo ✓");
    else mostrarToast("Não foi possível salvar neste navegador.", true);
  }

  // ===== Diálogos (ajuda, termos, privacidade, problema) =====
  function prepararDialogos() {
    document.querySelectorAll(".cfg-dialogo").forEach(dialogo => {
      dialogo.querySelectorAll("[data-fechar]").forEach(b => b.addEventListener("click", () => dialogo.close()));
      dialogo.addEventListener("click", (e) => { if (e.target === dialogo) dialogo.close(); }); // clique fora fecha
    });
    document.querySelectorAll("[data-abrir]").forEach(botao => {
      botao.addEventListener("click", () => {
        document.querySelectorAll(".cfg-dialogo[open]").forEach(d => d.close());
        $(botao.dataset.abrir).showModal();
      });
    });
    $("form-cfg-problema").addEventListener("submit", enviarProblema);
  }

  function abrirEmail(assunto, linhas) {
    location.href = `mailto:${EMAIL_SUPORTE}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(linhas.join("\n"))}`;
  }

  function dadosTecnicos() {
    const usuario = sessao.obter() || {};
    return [
      "— Informações técnicas —",
      `Usuário: ${usuario.nome || "-"} (${document.body.dataset.area})`,
      `Versão do app: ${VERSAO_APP}`,
      `Navegador: ${navigator.userAgent}`
    ];
  }

  function enviarProblema(e) {
    e.preventDefault();
    const texto = $("cfg-problema-texto");
    const erro = $("cfg-problema-erro");
    if (texto.value.trim().length < 10) {
      erro.textContent = "Descreva o problema com pelo menos 10 caracteres.";
      erro.hidden = false;
      texto.setAttribute("aria-invalid", "true");
      texto.focus();
      return;
    }
    erro.hidden = true;
    texto.removeAttribute("aria-invalid");
    abrirEmail(`[Hub AACD] ${$("cfg-problema-tipo").value}`, [texto.value.trim(), "", ...dadosTecnicos()]);
    $("dialogo-cfg-problema").close();
    e.target.reset();
    mostrarToast("Abrimos seu e-mail com o relato pronto para enviar.");
  }

  // ===== Conta =====
  async function sairDaConta() {
    if (await confirmar("Deseja sair da sua conta neste navegador?", "Sair")) {
      // Encerra a sessão no servidor (se ele estiver no ar) e volta ao início
      try { await AACD.api.logout(); } catch { /* servidor fora do ar: sai mesmo assim */ }
      AACD.util.sessao.limpar();
      location.hash = "#/";
    }
  }

  async function excluirConta() {
    const ok = await confirmar(
      "Excluir a conta é definitivo: seu cadastro e seu histórico serão removidos.\n\n" +
      "Vamos abrir um e-mail de solicitação para a equipe AACD concluir a exclusão.",
      "Excluir conta"
    );
    if (!ok) return;
    const usuario = sessao.obter() || {};
    abrirEmail("[Hub AACD] Solicitação de exclusão de conta", [
      `Solicito a exclusão definitiva da minha conta (${usuario.nome || "-"}) e dos meus dados, conforme a LGPD.`,
      "",
      ...dadosTecnicos()
    ]);
  }

  AACD.telas["tela-configuracoes"] = {
    iniciar() {
      form = $("cfg-form");
      form.addEventListener("change", salvarMudanca);
      form.addEventListener("submit", (e) => e.preventDefault());
      $("cfg-sair").addEventListener("click", sairDaConta);
      $("cfg-excluir").addEventListener("click", excluirConta);
      prepararDialogos();
    },

    aoEntrar() {
      preencher(prefs.ler());
    },

    aoSair() {
      document.querySelectorAll(".cfg-dialogo[open]").forEach(d => d.close());
    }
  };
})();
