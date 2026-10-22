/* =========================================================
   telas/cadastrar-demanda.js — nova demanda em 4 etapas
   As próteses cadastradas e a publicação passam pela API.
   O rascunho fica só no navegador (localStorage).
   ========================================================= */
"use strict";

(() => {
  const { $, hojeISO, mostrarToast, armazenamento } = AACD.util;

  // Campos obrigatórios de cada etapa (ids sem o prefixo "cd-")
  const etapasConfig = [
    ["nome", "quantidade"],
    ["tipo", "regiao", "paciente", "prioridade"],
    ["filamento", "bico", "largura", "profundidade", "altura", "tempo-horas"],
    ["prazo", "forma-entrega", "unidade", "responsavel"]
  ];
  const ULTIMA = etapasConfig.length - 1;

  // Campos guardados no rascunho
  const camposRascunho = [
    "nome", "protese", "quantidade",
    "tipo", "regiao", "paciente", "prioridade", "observacoes",
    "filamento", "bico", "largura", "profundidade", "altura", "tempo-horas", "tempo-minutos",
    "prazo", "forma-entrega", "unidade", "responsavel", "instrucoes"
  ];
  const camposMedida = ["largura", "profundidade", "altura"];
  const CHAVE_RASCUNHO = "rascunhoDemanda";

  let protesesCadastradas = [];
  let etapaAtual = 0;
  let etapaMaxima = 0;
  let publicando = false;
  let rascunhoVerificado = false;
  const el = {};

  const campo = (id) => $(`cd-${id}`);
  const valor = (id) => campo(id).value.trim();

  function tempoTotalMin() {
    return (Number(campo("tempo-horas").value) || 0) * 60 + (Number(campo("tempo-minutos").value) || 0);
  }

  function campoValido(id) {
    const entrada = campo(id);
    const texto = entrada.value.trim();
    let ok = texto !== "";

    if (id === "paciente") ok = /^PAC-\d{3,}$/i.test(texto);
    if (id === "quantidade" && ok) ok = Number.isInteger(Number(texto)) && Number(texto) > 0;
    if (camposMedida.includes(id) && ok) ok = Number(texto) > 0;
    if (id === "prazo" && ok) ok = texto >= hojeISO();
    if (id === "tempo-horas") {
      // horas e minutos são validados juntos
      const h = Number(texto) || 0;
      const m = Number(campo("tempo-minutos").value) || 0;
      ok = h >= 0 && m >= 0 && m < 60 && tempoTotalMin() > 0;
      campo("tempo-minutos").setAttribute("aria-invalid", String(!ok));
    }

    entrada.closest(".campo").classList.toggle("invalido", !ok);
    entrada.setAttribute("aria-invalid", String(!ok));
    return ok;
  }

  function validarEtapa(indice) {
    let primeiroInvalido = null;
    etapasConfig[indice].forEach(id => {
      if (!campoValido(id) && !primeiroInvalido) primeiroInvalido = campo(id);
    });
    if (primeiroInvalido) primeiroInvalido.focus();
    return !primeiroInvalido;
  }

  function irParaEtapa(indice, focar = true) {
    etapaAtual = indice;
    etapaMaxima = Math.max(etapaMaxima, indice);

    el.passos.forEach((p, i) => { p.hidden = i !== indice; });
    el.botoesEtapa.forEach((b, i) => {
      if (i === indice) b.setAttribute("aria-current", "step");
      else b.removeAttribute("aria-current");
      b.classList.toggle("etapa--concluida", i < etapaMaxima && i !== indice);
      b.disabled = i > etapaMaxima;
    });

    el.btnProximo.innerHTML = indice === ULTIMA ? "Publicar demanda" : 'Próximo <span aria-hidden="true">→</span>';
    el.btnVoltar.hidden = indice === 0;

    if (!focar) return;
    const primeiro = el.passos[indice].querySelector("input, select, textarea");
    if (primeiro) primeiro.focus();
  }

  // ===== Próteses cadastradas =====
  function carregarProteses() {
    const atual = el.protese.value;
    el.protese.replaceChildren(new Option("Selecione uma prótese cadastrada", ""));
    protesesCadastradas.forEach(p => el.protese.add(new Option(`${p.codigo || p.id} — ${p.nome}`, p.id)));
    el.protese.value = atual;
  }

  // Coloca um valor num campo. Se o <select> não tiver a opção, ela é criada.
  function definirCampo(id, valorNovo) {
    const entrada = campo(id);
    const texto = valorNovo === null || valorNovo === undefined ? "" : String(valorNovo);
    if (entrada.tagName === "SELECT" && texto !== "" && ![...entrada.options].some(o => o.value === texto)) {
      entrada.add(new Option(texto, texto));
    }
    entrada.value = texto;
    entrada.closest(".campo").classList.remove("invalido");
    entrada.removeAttribute("aria-invalid");
  }

  // Preenche os dados da peça com a prótese escolhida (tudo continua editável)
  function preencherComProtese(id) {
    const p = protesesCadastradas.find(item => String(item.id) === String(id));
    if (!p) return;

    definirCampo("tipo", p.tipo);
    definirCampo("regiao", p.regiao);
    definirCampo("filamento", p.filamento);
    definirCampo("bico", p.bico);
    definirCampo("largura", p.largura);
    definirCampo("profundidade", p.profundidade);
    definirCampo("altura", p.altura);
    definirCampo("tempo-horas", p.horas);
    definirCampo("tempo-minutos", p.minutos);
    if (!valor("nome")) campo("nome").value = `Demanda – ${p.nome}`;

    // O banco ainda não guarda bico nem tempo de impressão: avisa o que falta
    const faltam = [];
    if (p.bico === null || p.bico === undefined) faltam.push("bico");
    if (p.horas === null || p.horas === undefined) faltam.push("tempo de impressão");
    mostrarToast(faltam.length
      ? `Dados de "${p.nome}" preenchidos. Falta informar: ${faltam.join(" e ")}.`
      : `Dados de "${p.nome}" preenchidos.`);
  }

  // O id e a data de criação quem define é a API
  function montarDemanda() {
    const arquivo = campo("arquivo").files[0];
    return {
      nome: valor("nome"),
      proteseId: valor("protese"),
      quantidade: Number(valor("quantidade")),
      tipo: valor("tipo"),
      regiao: valor("regiao"),
      paciente: valor("paciente").toUpperCase(),
      prioridade: valor("prioridade"),
      arquivo: arquivo ? arquivo.name : "",
      observacoes: valor("observacoes"),
      impressao: {
        filamento: valor("filamento"),
        bico: Number(valor("bico")),
        largura: Number(valor("largura")),
        profundidade: Number(valor("profundidade")),
        altura: Number(valor("altura")),
        tempoEstimadoMin: tempoTotalMin()
      },
      entrega: {
        prazo: valor("prazo"),
        forma: valor("forma-entrega"),
        local: valor("unidade"),
        responsavel: valor("responsavel"),
        instrucoes: valor("instrucoes")
      }
    };
  }

  // ===== Rascunho =====
  function salvarRascunho() {
    const rascunho = { etapa: etapaMaxima };
    camposRascunho.forEach(id => { rascunho[id] = campo(id).value; });
    mostrarToast(armazenamento.gravar(CHAVE_RASCUNHO, rascunho) ? "Rascunho salvo." : "Não foi possível salvar o rascunho.");
  }

  function carregarRascunho() {
    const rascunho = armazenamento.ler(CHAVE_RASCUNHO);
    if (!rascunho) return;
    camposRascunho.forEach(id => { if (rascunho[id] !== undefined) campo(id).value = rascunho[id]; });
    etapaMaxima = Math.min(rascunho.etapa || 0, ULTIMA);
    mostrarToast("Rascunho carregado.");
  }

  // ===== Publicar =====
  async function publicar() {
    if (publicando) return;
    publicando = true;
    el.btnProximo.disabled = true;
    el.btnProximo.textContent = "Publicando...";
    try {
      const salva = await AACD.api.publicarDemanda(montarDemanda());
      armazenamento.apagar(CHAVE_RASCUNHO);
      mostrarToast(`Demanda "${salva.nome || valor("nome")}" publicada para os voluntários!`);
      el.form.reset();
      el.form.querySelectorAll(".invalido").forEach(c => c.classList.remove("invalido"));
      el.form.querySelectorAll("[aria-invalid]").forEach(c => c.removeAttribute("aria-invalid"));
      etapaMaxima = 0;
      irParaEtapa(0);
    } catch (erro) {
      mostrarToast(erro.message, true);
      el.btnProximo.textContent = "Publicar demanda";
    } finally {
      publicando = false;
      el.btnProximo.disabled = false;
    }
  }

  AACD.telas["tela-cadastrar-demanda"] = {
    iniciar() {
      el.form = $("form-demanda");
      el.passos = el.form.querySelectorAll(".passo");
      el.botoesEtapa = $("cd-etapas").querySelectorAll(".etapa");
      el.btnProximo = $("cd-proximo");
      el.btnVoltar = $("cd-voltar");
      el.protese = campo("protese");

      el.form.addEventListener("submit", e => {
        e.preventDefault();
        if (!validarEtapa(etapaAtual)) return;
        if (etapaAtual === ULTIMA) publicar();
        else irParaEtapa(etapaAtual + 1);
      });

      $("cd-rascunho").addEventListener("click", salvarRascunho);
      el.btnVoltar.addEventListener("click", () => etapaAtual > 0 && irParaEtapa(etapaAtual - 1));

      el.botoesEtapa.forEach(botao => botao.addEventListener("click", () => {
        const destino = Number(botao.dataset.etapa);
        if (destino > etapaMaxima) return;
        if (destino > etapaAtual && !validarEtapa(etapaAtual)) return;
        irParaEtapa(destino);
      }));

      // Corrigiu o campo? some o erro (horas e minutos validam juntos)
      el.form.addEventListener("input", e => {
        const recipiente = e.target.closest(".campo");
        if (!recipiente || !recipiente.classList.contains("invalido")) return;
        const id = e.target.id.replace(/^cd-/, "");
        campoValido(id === "tempo-minutos" ? "tempo-horas" : id);
      });

      el.protese.addEventListener("change", () => preencherComProtese(el.protese.value));
      campo("paciente").addEventListener("input", e => { e.target.value = e.target.value.toUpperCase(); });

      irParaEtapa(0, false);
    },

    async aoEntrar() {
      campo("prazo").min = hojeISO(); // não deixa escolher prazo no passado
      try {
        protesesCadastradas = await AACD.api.listarProteses();
      } catch {
        mostrarToast("Não foi possível carregar as próteses cadastradas.", true);
      }
      carregarProteses();
      // O rascunho é carregado só na primeira visita (depois a tela mantém o que foi digitado)
      if (!rascunhoVerificado) {
        rascunhoVerificado = true;
        carregarRascunho();
        irParaEtapa(0, false);
      }
    }
  };
})();
