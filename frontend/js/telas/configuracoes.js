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

  let form, notificacoes, preferenciasServidor;

  function mostrarPreferenciasNotificacoes(p) {
    preferenciasServidor = p;
    form.elements.notifAtualizacoes.checked = p.hub;
    form.elements.canalEmail.checked = p.email;
    const status = $("cfg-status-notificacoes");
    if (!p.emailDisponivel) status.textContent = "O envio por e-mail depende da configuração do servidor.";
    else if (p.emailDeTeste) status.textContent = "Envio em modo de teste. Para receber, o e-mail desta conta do Hub deve ser o mesmo da sua conta no Resend.";
    else status.textContent = "";
    AACD.notificacoes.preferencia(p.hub);
  }

  async function carregarNotificacoes() {
    preferenciasServidor = null;
    notificacoes.disabled = true;
    form.elements.notifAtualizacoes.checked = false;
    form.elements.canalEmail.checked = false;
    $("cfg-status-notificacoes").textContent = "Carregando preferências…";
    try {
      mostrarPreferenciasNotificacoes(await AACD.api.preferenciasNotificacoes());
      notificacoes.disabled = false;
    } catch (erro) {
      $("cfg-status-notificacoes").textContent = erro.message;
    }
  }

  async function salvarCanal() {
    if (!preferenciasServidor) return;
    const anterior = preferenciasServidor;
    notificacoes.disabled = true;
    try {
      mostrarPreferenciasNotificacoes(await AACD.api.salvarNotificacoes({
        hub: form.elements.notifAtualizacoes.checked,
        email: form.elements.canalEmail.checked
      }));
      mostrarToast("Preferências de notificação salvas.");
    } catch (erro) {
      mostrarPreferenciasNotificacoes(anterior);
      mostrarToast(erro.message, true);
    } finally { notificacoes.disabled = false; }
  }

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
  function prepararExclusao() {
    const dialogo = $("dialogo-cfg-excluir");
    const formulario = $("form-cfg-excluir");
    const resposta = $("cfg-exclusao-resposta");
    const erro = $("cfg-exclusao-erro");
    let encerrada = false, enviando = false;
    $("cfg-excluir").addEventListener("click", () => {
      formulario.reset();
      erro.textContent = "";
      formulario.hidden = false;
      resposta.hidden = true;
      dialogo.showModal();
    });
    $("cfg-exclusao-cancelar").onclick = () => dialogo.close();
    $("cfg-exclusao-fechar").onclick = () => dialogo.close();
    dialogo.addEventListener("cancel", e => { if (enviando) e.preventDefault(); });
    dialogo.addEventListener("close", () => {
      formulario.reset();
      if (encerrada) { encerrada = false; location.hash = "#/"; }
    });
    formulario.addEventListener("submit", async e => {
      e.preventDefault();
      if (enviando) return;
      enviando = true;
      const botoes = [...formulario.querySelectorAll("button")];
      botoes.forEach(b => { b.disabled = true; });
      erro.textContent = "";
      try {
        const resultado = await AACD.api.excluirConta($("cfg-exclusao-senha").value);
        encerrada = true;
        sessao.limpar();
        AACD.notificacoes.sessao();
        formulario.reset();
        formulario.hidden = true;
        const mensagens = {
          concluida: "Sua conta, impressoras, foto de perfil e preferências foram excluídas dos sistemas ativos.",
          limpeza: "Seu acesso foi encerrado. Parte da exclusão ainda está sendo processada. Guarde o protocolo.",
          revisao: "Seu acesso foi encerrado. Há registros vinculados a pedidos ou atividades do Hub. O responsável precisa revisar esses vínculos antes de concluir a exclusão."
        };
        $("cfg-exclusao-mensagem").textContent = mensagens[resultado.estado] || mensagens.limpeza;
        $("cfg-exclusao-protocolo").textContent = resultado.protocolo;
        resposta.hidden = false;
        $("cfg-exclusao-fechar").focus();
      } catch (falha) {
        erro.textContent = falha.message;
        $("cfg-exclusao-senha").value = "";
        $("cfg-exclusao-senha").focus();
      } finally {
        enviando = false;
        botoes.forEach(b => { b.disabled = false; });
      }
    });
  }

  AACD.telas["tela-configuracoes"] = {
    iniciar() {
      form = $("cfg-form");
      notificacoes = $("cfg-canais");
      form.addEventListener("change", e => {
        if (notificacoes.contains(e.target)) salvarCanal();
        else salvarMudanca();
      });
      form.addEventListener("submit", (e) => e.preventDefault());
      $("cfg-sair").addEventListener("click", AACD.util.sairDaConta);
      prepararExclusao();
      prepararDialogos();
    },

    aoEntrar() {
      preencher(prefs.ler());
      carregarNotificacoes();
    },

    aoSair() {
      document.querySelectorAll(".cfg-dialogo[open]").forEach(d => d.close());
    }
  };
})();
