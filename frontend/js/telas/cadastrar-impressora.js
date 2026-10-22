/* =========================================================
   telas/cadastrar-impressora.js — cadastro em 5 etapas
   Por enquanto a impressora é salva no navegador (localStorage),
   como no projeto original. Para usar a API, troque o trecho
   marcado em cadastrar() por uma chamada em api.js.
   ========================================================= */
"use strict";

(() => {
  const { $, escapar, mostrarToast, mascaras, armazenamento } = AACD.util;

  // Campos obrigatórios de cada etapa (ids sem o prefixo "ci-")
  const etapasConfig = [
    { nome: "Identificação", campos: ["nome", "marca", "modelo", "tecnologia"] },
    { nome: "Endereço", campos: ["cep", "rua", "numero", "bairro", "cidade", "estado"] },
    { nome: "Especificações", campos: ["volume-x", "volume-y", "volume-z", "bico"] },
    { nome: "Filamento", campos: ["diametro-filamento"] },
    { nome: "Revisão", campos: [] }
  ];
  const ULTIMA = etapasConfig.length - 1;

  let etapaAtual = 0;
  let etapaMaxima = 0; // etapa mais avançada que o usuário já alcançou
  const el = {};

  const campo = (id) => $(`ci-${id}`);
  const valor = (id) => campo(id).value.trim();
  const marcado = (id) => campo(id).checked;
  const materiaisSelecionados = () => [...el.form.querySelectorAll('input[name="materiais"]:checked')].map(c => c.value);

  function marcarErro(entrada, temErro) {
    entrada.closest(".campo").classList.toggle("invalido", temErro);
    entrada.setAttribute("aria-invalid", String(temErro));
  }

  function campoValido(id) {
    const entrada = campo(id);
    const texto = entrada.value.trim();
    let ok = texto !== "";
    if (id === "cep") ok = /^\d{5}-?\d{3}$/.test(texto);
    if (id === "estado") ok = /^[A-Za-z]{2}$/.test(texto);
    if (entrada.type === "number" && ok) ok = Number(texto) > 0;
    marcarErro(entrada, !ok);
    return ok;
  }

  function validarEtapa(indice) {
    let primeiroInvalido = null;
    etapasConfig[indice].campos.forEach(id => {
      if (!campoValido(id) && !primeiroInvalido) primeiroInvalido = campo(id);
    });

    // Na etapa de filamento, pelo menos um material precisa estar marcado
    if (indice === 3) {
      const temMaterial = materiaisSelecionados().length > 0;
      el.erroMateriais.classList.toggle("visivel", !temMaterial);
      if (!temMaterial && !primeiroInvalido) primeiroInvalido = el.form.querySelector('input[name="materiais"]');
    }

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
    const primeiro = el.passos[indice].querySelector("input, select, h2");
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

  function montarRevisao() {
    const endereco = `${valor("rua")}, ${valor("numero")}${valor("complemento") ? " - " + valor("complemento") : ""}`;
    const diametro = valor("diametro-filamento");
    el.revisao.innerHTML =
      bloco("Identificação", 0, [
        ["Nome", valor("nome")], ["Marca", valor("marca")], ["Modelo", valor("modelo")], ["Tecnologia", valor("tecnologia")]
      ]) +
      bloco("Endereço", 1, [
        ["CEP", valor("cep")], ["Endereço", endereco], ["Bairro", valor("bairro")],
        ["Cidade", `${valor("cidade")} / ${valor("estado").toUpperCase()}`]
      ]) +
      bloco("Especificações", 2, [
        ["Área (X×Y×Z)", `${valor("volume-x")} × ${valor("volume-y")} × ${valor("volume-z")} mm`],
        ["Bico", valor("bico") && `${valor("bico")} mm`],
        ["Temp. máx.", valor("temp-bico") && `${valor("temp-bico")} °C`],
        ["Velocidade", valor("velocidade") && `${valor("velocidade")} mm/s`],
        ["Mesa aquecida", marcado("mesa-aquecida") ? "Sim" : "Não"],
        ["Enclausurada", marcado("enclausurada") ? "Sim" : "Não"]
      ]) +
      bloco("Filamento", 3, [
        ["Materiais", materiaisSelecionados().join(", ")],
        ["Diâmetro", diametro && diametro !== "Não se aplica" ? `${diametro} mm` : diametro],
        ["Cores", valor("cores")]
      ]);
  }

  function montarImpressora() {
    return {
      id: Date.now(),
      nome: valor("nome"),
      marca: valor("marca"),
      modelo: valor("modelo"),
      tecnologia: valor("tecnologia"),
      endereco: {
        cep: valor("cep"), rua: valor("rua"), numero: valor("numero"), complemento: valor("complemento"),
        bairro: valor("bairro"), cidade: valor("cidade"), estado: valor("estado").toUpperCase()
      },
      especificacoes: {
        volume: { x: Number(valor("volume-x")), y: Number(valor("volume-y")), z: Number(valor("volume-z")) },
        bico: Number(valor("bico")),
        tempBico: Number(valor("temp-bico")) || null,
        velocidade: Number(valor("velocidade")) || null,
        mesaAquecida: marcado("mesa-aquecida"),
        enclausurada: marcado("enclausurada")
      },
      filamento: { materiais: materiaisSelecionados(), diametro: valor("diametro-filamento"), cores: valor("cores") }
    };
  }

  function cadastrar() {
    const impressora = montarImpressora();

    // ----- Salvamento (trocar por AACD.api quando a rota existir) -----
    const salvas = armazenamento.ler("impressoras") || [];
    salvas.push(impressora);
    if (!armazenamento.gravar("impressoras", salvas)) {
      mostrarToast("Não foi possível salvar a impressora neste navegador.", true);
      return;
    }

    mostrarToast(`Impressora "${impressora.nome}" cadastrada com sucesso!`);
    reiniciar();
  }

  function reiniciar() {
    el.form.reset();
    el.form.querySelectorAll(".invalido").forEach(c => c.classList.remove("invalido"));
    el.form.querySelectorAll("[aria-invalid]").forEach(c => c.removeAttribute("aria-invalid"));
    el.erroMateriais.classList.remove("visivel");
    etapaMaxima = 0;
    irParaEtapa(0);
  }

  // Busca de CEP (ViaCEP). Sem internet, o usuário preenche à mão.
  async function buscarCep() {
    const cep = valor("cep").replace(/\D/g, "");
    if (cep.length !== 8) return;
    try {
      const dados = await AACD.api.buscarCep(cep);
      if (!dados) return mostrarToast("CEP não encontrado.", true);
      const preencher = { rua: dados.rua, bairro: dados.bairro, cidade: dados.cidade, estado: dados.uf };
      Object.entries(preencher).forEach(([id, texto]) => {
        if (texto) { campo(id).value = texto; marcarErro(campo(id), false); }
      });
      campo("numero").focus();
    } catch { /* sem conexão: preenchimento manual */ }
  }

  AACD.telas["tela-cadastrar-impressora"] = {
    iniciar() {
      el.form = $("form-impressora");
      el.passos = el.form.querySelectorAll(".passo");
      el.botoesEtapa = $("ci-etapas").querySelectorAll(".etapa");
      el.btnProximo = $("ci-proximo");
      el.btnVoltar = $("ci-voltar");
      el.revisao = $("ci-revisao");
      el.erroMateriais = $("ci-materiais-erro");

      // "Próximo" é o botão de envio: Enter também avança
      el.form.addEventListener("submit", e => {
        e.preventDefault();
        if (etapaAtual === ULTIMA) return cadastrar();
        if (validarEtapa(etapaAtual)) irParaEtapa(etapaAtual + 1);
      });

      el.btnVoltar.addEventListener("click", () => etapaAtual > 0 && irParaEtapa(etapaAtual - 1));

      // Clicar no nome da etapa (só nas já alcançadas)
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
        const alvo = e.target;
        if (alvo.name === "materiais") {
          if (materiaisSelecionados().length) el.erroMateriais.classList.remove("visivel");
          return;
        }
        const recipiente = alvo.closest(".campo");
        if (recipiente && recipiente.classList.contains("invalido")) campoValido(alvo.id.replace(/^ci-/, ""));
      });

      // Máscara do CEP e busca automática
      campo("cep").addEventListener("input", e => {
        e.target.value = mascaras.cep(e.target.value);
        if (e.target.value.length === 9) buscarCep();
      });

      // UF sempre em maiúsculo
      campo("estado").addEventListener("input", e => {
        e.target.value = e.target.value.replace(/[^A-Za-z]/g, "").toUpperCase();
      });

      irParaEtapa(0, false);
    }
  };
})();
