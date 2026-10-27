/* =========================================================
   telas/cadastrar-protese.js — funcionário cadastra uma prótese
   em 4 etapas. Os campos seguem a tabela "protese" do MySQL.
   ========================================================= */
"use strict";

(() => {
  const { $, escapar, mostrarToast } = AACD.util;

  // Campos de cada etapa (ids sem o prefixo "cp-")
  const etapasConfig = [
    { nome: "Identificação", campos: ["nome", "tipo"] },
    { nome: "Especificações", campos: ["largura", "profundidade", "altura"] },
    { nome: "Impressão", campos: ["camada", "infill"] },
    { nome: "Revisão", campos: [] }
  ];
  const ULTIMA = etapasConfig.length - 1;
  const OBRIGATORIOS = ["nome", "tipo"];

  let etapaAtual = 0;
  let etapaMaxima = 0; // etapa mais avançada que o usuário já alcançou
  let enviando = false;
  const el = {};

  const campo = (id) => $(`cp-${id}`);
  const valor = (id) => campo(id).value.trim();
  const numeroOuNulo = (id) => (valor(id) === "" ? null : Number(valor(id)));

  function marcarErro(entrada, temErro) {
    entrada.closest(".campo").classList.toggle("invalido", temErro);
    entrada.setAttribute("aria-invalid", String(temErro));
  }

  // Obrigatórios precisam estar preenchidos; números opcionais só são
  // validados quando preenchidos (respeitando os limites do banco)
  function campoValido(id) {
    const entrada = campo(id);
    const texto = entrada.value.trim();
    let ok = OBRIGATORIOS.includes(id) ? texto !== "" : true;
    if (entrada.type === "number" && texto !== "") {
      const n = Number(texto);
      ok = Number.isFinite(n) && n >= Number(entrada.min) && n <= Number(entrada.max);
      if (id === "infill") ok = ok && Number.isInteger(n);
    }
    marcarErro(entrada, !ok);
    return ok;
  }

  function validarEtapa(indice) {
    let primeiroInvalido = null;
    etapasConfig[indice].campos.forEach(id => {
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

    el.btnVoltar.hidden = indice === 0;
    el.btnProximo.innerHTML = indice === ULTIMA ? 'Cadastrar <span aria-hidden="true">✓</span>' : 'Próximo <span aria-hidden="true">→</span>';

    if (indice === ULTIMA) montarRevisao();
    if (!focar) return;
    const primeiro = el.passos[indice].querySelector("input, select, textarea, h2");
    if (primeiro) {
      if (primeiro.tagName === "H2") primeiro.tabIndex = -1;
      primeiro.focus();
    }
  }

  function bloco(titulo, etapa, pares) {
    return `
      <section class="revisao__bloco" aria-label="${titulo}">
        <header>
          <h3>${titulo}</h3>
          <button type="button" data-ir="${etapa}">Editar<span class="visualmente-oculto"> ${titulo.toLowerCase()}</span></button>
        </header>
        <dl>${pares.map(([r, v]) => `<dt>${r}</dt><dd>${v ? escapar(v) : "—"}</dd>`).join("")}</dl>
      </section>`;
  }

  const comUnidade = (id, unidade) => valor(id) && `${valor(id)} ${unidade}`;

  function montarRevisao() {
    el.revisao.innerHTML =
      bloco("Identificação", 0, [
        ["Nome", valor("nome")], ["Código", valor("codigo")], ["Tipo", valor("tipo")],
        ["Região do corpo", valor("regiao")], ["Versão", valor("versao")], ["Status", valor("status")],
        ["Descrição", valor("descricao")]
      ]) +
      bloco("Especificações", 1, [
        ["Material", valor("material")],
        ["Largura", comUnidade("largura", "mm")],
        ["Profundidade", comUnidade("profundidade", "mm")],
        ["Altura", comUnidade("altura", "mm")]
      ]) +
      bloco("Impressão", 2, [
        ["Arquivo 3D", valor("arquivo")],
        ["Altura de camada", comUnidade("camada", "mm")],
        ["Infill", comUnidade("infill", "%")],
        ["Suporte", campo("suporte").checked ? "Sim" : "Não"],
        ["Orientações", valor("orientacoes")],
        ["Observações", valor("observacoes")]
      ]);
  }

  // Nomes iguais aos das colunas da tabela "protese"
  function montarProtese() {
    return {
      nome: valor("nome"),
      codigo: valor("codigo") || null,
      tipo: valor("tipo"),
      regiao_corpo: valor("regiao") || null,
      descricao: valor("descricao") || null,
      material_recomendado: valor("material") || null,
      largura: numeroOuNulo("largura"),
      profundidade: numeroOuNulo("profundidade"),
      altura: numeroOuNulo("altura"),
      arquivo_3d: valor("arquivo") || null,
      altura_camada: numeroOuNulo("camada"),
      infill: numeroOuNulo("infill"),
      necessita_suporte: campo("suporte").checked,
      orientacoes_impressao: valor("orientacoes") || null,
      observacoes: valor("observacoes") || null,
      versao: valor("versao") || null,
      status: valor("status")
    };
  }

  async function cadastrar() {
    if (enviando) return;
    // Revalida tudo antes de enviar (o usuário pode ter pulado etapas pelo breadcrumb)
    for (let i = 0; i < ULTIMA; i++) {
      if (!etapasConfig[i].campos.every(campoValido)) { irParaEtapa(i); validarEtapa(i); return; }
    }

    const protese = montarProtese();
    enviando = true;
    el.btnProximo.disabled = true;
    el.btnProximo.textContent = "Cadastrando...";
    try {
      await AACD.api.cadastrarProtese(protese);
      mostrarToast(`Prótese "${protese.nome}" cadastrada com sucesso!`);
      reiniciar();
    } catch (erro) {
      mostrarToast(erro.message || "Não foi possível cadastrar a prótese.", true);
    } finally {
      enviando = false;
      el.btnProximo.disabled = false;
      el.btnProximo.innerHTML = etapaAtual === ULTIMA
        ? 'Cadastrar <span aria-hidden="true">✓</span>'
        : 'Próximo <span aria-hidden="true">→</span>';
    }
  }

  function reiniciar() {
    el.form.reset();
    el.form.querySelectorAll(".invalido").forEach(c => c.classList.remove("invalido"));
    el.form.querySelectorAll("[aria-invalid]").forEach(c => c.removeAttribute("aria-invalid"));
    etapaMaxima = 0;
    irParaEtapa(0);
  }

  AACD.telas["tela-cadastrar-protese"] = {
    iniciar() {
      el.form = $("form-protese");
      el.passos = el.form.querySelectorAll(".passo");
      el.botoesEtapa = $("cp-etapas").querySelectorAll(".etapa");
      el.btnProximo = $("cp-proximo");
      el.btnVoltar = $("cp-voltar");
      el.revisao = $("cp-revisao");

      // "Próximo" é o botão de envio: Enter também avança
      el.form.addEventListener("submit", e => {
        e.preventDefault();
        if (etapaAtual === ULTIMA) return cadastrar();
        if (validarEtapa(etapaAtual)) irParaEtapa(etapaAtual + 1);
      });

      el.btnVoltar.addEventListener("click", () => etapaAtual > 0 && irParaEtapa(etapaAtual - 1));

      // Clicar no nome da etapa no breadcrumb (só nas já alcançadas)
      el.botoesEtapa.forEach(botao => botao.addEventListener("click", () => {
        const destino = Number(botao.dataset.etapa);
        if (destino > etapaMaxima) return;
        if (destino > etapaAtual && !validarEtapa(etapaAtual)) return;
        irParaEtapa(destino);
      }));

      // Botões "Editar" da revisão
      el.revisao.addEventListener("click", e => {
        const botao = e.target.closest("button[data-ir]");
        if (botao) irParaEtapa(Number(botao.dataset.ir));
      });

      // Corrigiu o campo? some o erro.
      el.form.addEventListener("input", e => {
        const recipiente = e.target.closest(".campo");
        if (recipiente && recipiente.classList.contains("invalido")) campoValido(e.target.id.replace(/^cp-/, ""));
      });

      irParaEtapa(0, false);
    }
  };
})();
