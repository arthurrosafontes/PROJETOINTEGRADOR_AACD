/* =========================================================
   telas/lista-demandas.js — funcionário acompanha as demandas,
   vê os detalhes, edita as que ainda não começaram e cancela.
   Cancelar só muda o status: o registro continua no MySQL.
   ========================================================= */
"use strict";

(() => {
  const { $, escapar, formatarData, hojeISO, mostrarToast, confirmar, alternarDetalhes, listaDescricao } = AACD.util;

  // Mesmas regras do backend (backend/routes/demandas.js)
  // Só "Aberta" edita; nos outros status o botão é "Adicionar observação"
  const STATUS_EDITAVEIS = ["Aberta"];
  const STATUS_CANCELAVEIS = ["Rascunho", "Aberta", "Em produção"];
  const PESO_PRIORIDADE = { Urgente: 4, Alta: 3, Normal: 2, Baixa: 1 };

  let demandas = [];
  let idEmEdicao = null;
  let idObservacao = null;
  const el = {};

  // "Aguardando validação" -> "aguardando-validacao" (para usar como classe CSS)
  const classeStatus = (status) => String(status || "").normalize("NFD")
    .replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, "-");

  const unidades = (n) => `${n} ${Number(n) === 1 ? "unidade" : "unidades"}`;
  const medida = (v, sufixo) => (v === null || v === undefined ? "" : `${String(v).replace(".", ",")} ${sufixo}`);

  function filtrar() {
    const termo = el.busca.value.trim().toLowerCase().replace(/^#/, "");
    const status = el.status.value;
    const prioridade = el.prioridade.value;

    const resultado = demandas.filter(d => {
      const pesquisa = [d.id, d.nome, d.protese, d.proteseCodigo].map(v => String(v ?? "").toLowerCase()).join(" ");
      return pesquisa.includes(termo) &&
        (status === "todos" || d.status === status) &&
        (prioridade === "todas" || d.prioridade === prioridade);
    });

    const porId = (a, b) => Number(b.id) - Number(a.id);
    const porPrazo = (a, b) => String(a.prazo || "9999").localeCompare(String(b.prazo || "9999"));
    if (el.ordenar.value === "recentes") {
      resultado.sort((a, b) => String(b.cadastro || "").localeCompare(String(a.cadastro || "")) || porId(a, b));
    }
    if (el.ordenar.value === "prazo") resultado.sort((a, b) => porPrazo(a, b) || porId(a, b));
    if (el.ordenar.value === "prioridade") {
      resultado.sort((a, b) => (PESO_PRIORIDADE[b.prioridade] || 0) - (PESO_PRIORIDADE[a.prioridade] || 0) || porPrazo(a, b));
    }
    return resultado;
  }

  function renderizar(destacarId = null) {
    const itens = filtrar();
    el.lista.innerHTML = itens.map(d => {
      const id = escapar(d.id);
      const status = classeStatus(d.status);
      const editavel = STATUS_EDITAVEIS.includes(d.status);
      const cancelavel = STATUS_CANCELAVEIS.includes(d.status);
      return `
      <li class="cartao-item cartao-item--faixa cartao-item--demanda-${status}${String(d.id) === String(destacarId) ? " atualizado" : ""}" data-id="${id}">
        <article aria-labelledby="ldem-titulo-${id}">
          <header class="cartao-item__titulo">
            <h2 id="ldem-titulo-${id}">Demanda #${id} — ${escapar(d.protese || d.nome)}</h2>
            <span class="selo selo--st-${status}">${escapar(d.status) || "-"}</span>
            <span class="selo selo--${escapar(d.prioridade)}">${escapar(d.prioridade) || "-"}</span>
          </header>
          <p class="cartao-item__subtitulo">${escapar(d.nome)}</p>
          <p class="cartao-item__detalhes">
            <span>Prótese: <strong>${escapar(d.protese) || "-"}</strong></span>
            <span>Quantidade: <strong>${escapar(unidades(d.quantidade))}</strong></span>
            <span>Material: <strong>${escapar(d.material) || "-"}</strong></span>
            <span>Prazo: <strong><time datetime="${escapar(d.prazo)}">${formatarData(d.prazo)}</time></strong></span>
            ${d.cadastro ? `<span>Cadastro: <strong><time datetime="${escapar(d.cadastro)}">${formatarData(d.cadastro)}</time></strong></span>` : ""}
          </p>
        </article>
        <div class="cartao-item__acoes">
          <button type="button" class="botao botao--secundario" data-acao="detalhes"
                  aria-expanded="false" aria-controls="ldem-extra-${id}">Detalhes</button>
          ${editavel
            ? `<button type="button" class="botao botao--escuro" data-acao="editar">Editar</button>`
            : `<button type="button" class="botao botao--escuro" data-acao="observacao">Adicionar observação</button>`}
          ${cancelavel ? `<button type="button" class="botao botao--perigo" data-acao="cancelar">Cancelar</button>` : ""}
        </div>
        <div class="cartao-item__extra cartao-item__extra--colunas" id="ldem-extra-${id}" hidden>
          <section aria-label="Identificação">
            <h3>Identificação</h3>
            ${listaDescricao([
              ["Nome:", escapar(d.nome)],
              ["Prótese:", escapar([d.proteseCodigo, d.protese].filter(Boolean).join(" — "))],
              ["Tipo:", escapar(d.tipo)],
              ["Região:", escapar(d.regiao)],
              ["Paciente:", escapar(d.paciente)],
              ["Cadastro:", d.cadastro ? formatarData(d.cadastro) : ""]
            ])}
          </section>
          <section aria-label="Especificações">
            <h3>Especificações</h3>
            ${listaDescricao([
              ["Quantidade:", escapar(unidades(d.quantidade))],
              ["Material:", escapar(d.material)],
              ["Bico:", escapar(medida(d.bico, "mm"))],
              ["Dimensões:", [d.largura, d.profundidade, d.altura].every(v => v !== null && v !== undefined)
                ? escapar(`${d.largura} × ${d.profundidade} × ${d.altura} mm`) : ""],
              ["Tempo estimado:", escapar(medida(d.tempoHoras, "h"))],
              ["Observações:", escapar(d.observacoes)]
            ])}
          </section>
          <section aria-label="Entrega">
            <h3>Entrega</h3>
            ${listaDescricao([
              ["Prazo:", formatarData(d.prazo)],
              ["Forma:", escapar(d.formaEntrega)],
              ["Local:", escapar(d.localEntrega)],
              ["Responsável:", escapar(d.responsavel)],
              ["Instruções:", escapar(d.instrucoes)]
            ])}
          </section>
        </div>
      </li>`;
    }).join("");

    el.contador.textContent = `${itens.length} demanda(s) encontrada(s)`;
    el.vazio.classList.remove("vazio--erro");
    el.vazio.textContent = "Nenhuma demanda encontrada.";
    el.vazio.hidden = itens.length > 0;
  }

  // ===== Editar =====
  function abrirModal(demanda) {
    idEmEdicao = demanda.id;
    const f = el.form;
    f.nome.value = demanda.nome ?? "";
    f.quantidade.value = demanda.quantidade ?? "";
    // Se o material não estiver na lista, cria a opção para não perder o valor
    if (demanda.material && ![...f.material.options].some(o => o.value === demanda.material)) {
      f.material.add(new Option(demanda.material, demanda.material));
    }
    f.material.value = demanda.material || "PLA";
    f.prioridade.value = PESO_PRIORIDADE[demanda.prioridade] ? demanda.prioridade : "Normal";
    f.bico.value = demanda.bico ?? "";
    f.tempo.value = demanda.tempoHoras ?? "";
    f.prazo.value = demanda.prazo ?? "";
    f.prazo.min = hojeISO();
    f.local.value = demanda.localEntrega ?? "";
    f.obs.value = demanda.observacoes ?? "";

    $("modal-demanda-protese").textContent = `#${demanda.id} · Prótese: ${demanda.protese || "-"}`;
    el.erro.hidden = true;
    f.querySelectorAll("[aria-invalid]").forEach(c => c.removeAttribute("aria-invalid"));
    el.modal.showModal();
    f.nome.focus();
  }

  function fecharModal() {
    el.modal.close();
  }

  function mostrarErroModal(mensagem, entrada = null) {
    el.erro.textContent = mensagem;
    el.erro.hidden = false;
    if (entrada) {
      entrada.setAttribute("aria-invalid", "true");
      entrada.focus();
    }
  }

  // Lê e valida o formulário. Retorna os campos ou null se algo estiver errado.
  function lerFormulario() {
    const f = el.form;
    f.querySelectorAll("[aria-invalid]").forEach(c => c.removeAttribute("aria-invalid"));
    el.erro.hidden = true;

    const campos = {
      nome: f.nome.value.trim(),
      quantidade: Number(f.quantidade.value),
      material: f.material.value,
      prioridade: f.prioridade.value,
      bico: Number(f.bico.value),
      tempoHoras: Number(f.tempo.value),
      prazo: f.prazo.value,
      localEntrega: f.local.value.trim(),
      observacoes: f.obs.value.trim()
    };

    const invalido = (mensagem, entrada) => { mostrarErroModal(mensagem, entrada); return null; };
    if (!campos.nome) return invalido("Informe o nome da demanda.", f.nome);
    if (!Number.isInteger(campos.quantidade) || campos.quantidade <= 0) {
      return invalido("A quantidade precisa ser um número inteiro maior que zero.", f.quantidade);
    }
    if (!f.bico.value || !(campos.bico > 0)) return invalido("Informe o diâmetro do bico.", f.bico);
    if (!f.tempo.value || !(campos.tempoHoras > 0)) return invalido("Informe o tempo estimado em horas.", f.tempo);
    if (!campos.prazo) return invalido("Informe o prazo de entrega.", f.prazo);
    return campos;
  }

  async function salvar(e) {
    e.preventDefault();
    if (idEmEdicao == null) return;
    const campos = lerFormulario();
    if (!campos) return;

    const id = idEmEdicao;
    el.salvar.disabled = true;
    el.salvar.textContent = "Salvando...";
    try {
      const atualizada = await AACD.api.atualizarDemanda(id, campos);
      demandas = demandas.map(d => (String(d.id) === String(id) ? { ...d, ...atualizada } : d));
      fecharModal();
      renderizar(id);
      mostrarToast(`Demanda #${id} atualizada.`);
    } catch (erro) {
      mostrarErroModal(erro.message);
    } finally {
      el.salvar.disabled = false;
      el.salvar.textContent = "Salvar alterações";
    }
  }

  // ===== Adicionar observação (demais status) =====
  function abrirObservacao(demanda) {
    idObservacao = demanda.id;
    el.obsTexto.value = "";
    el.obsTexto.removeAttribute("aria-invalid");
    el.obsErro.hidden = true;
    $("modal-observacao-demanda").textContent = `#${demanda.id} · ${demanda.nome} · ${demanda.status}`;
    el.obsModal.showModal();
    el.obsTexto.focus();
  }

  async function salvarObservacao(e) {
    e.preventDefault();
    if (idObservacao == null) return;
    const texto = el.obsTexto.value.trim();
    el.obsErro.hidden = true;
    if (!texto) {
      el.obsErro.textContent = "Escreva a observação.";
      el.obsErro.hidden = false;
      el.obsTexto.setAttribute("aria-invalid", "true");
      el.obsTexto.focus();
      return;
    }

    const id = idObservacao;
    el.obsSalvar.disabled = true;
    el.obsSalvar.textContent = "Adicionando...";
    try {
      const atualizada = await AACD.api.adicionarObservacaoDemanda(id, texto);
      demandas = demandas.map(d => (String(d.id) === String(id) ? { ...d, ...atualizada } : d));
      el.obsModal.close();
      renderizar(id);
      mostrarToast(`Observação adicionada à demanda #${id}.`);
    } catch (erro) {
      el.obsErro.textContent = erro.message;
      el.obsErro.hidden = false;
    } finally {
      el.obsSalvar.disabled = false;
      el.obsSalvar.textContent = "Adicionar";
    }
  }

  // ===== Cancelar (muda o status, não exclui) =====
  async function cancelar(botao, item, demanda) {
    const aviso = demanda.status === "Em produção"
      ? "\nA peça já está em produção: avise o voluntário responsável."
      : "";
    const ok = await confirmar(
      `Cancelar a demanda #${demanda.id} "${demanda.nome}"?\nO registro continua no sistema com o status "Cancelada".${aviso}`,
      "Cancelar demanda"
    );
    if (!ok) return;

    item.querySelectorAll("button").forEach(b => { b.disabled = true; });
    botao.textContent = "Cancelando...";
    try {
      const resposta = await AACD.api.cancelarDemanda(demanda.id);
      demanda.status = resposta.status || "Cancelada";
      renderizar(demanda.id);
      mostrarToast(`Demanda #${demanda.id} cancelada.`);
    } catch (erro) {
      item.querySelectorAll("button").forEach(b => { b.disabled = false; });
      botao.textContent = "Cancelar";
      mostrarToast(erro.message, true);
    }
  }

  AACD.telas["tela-lista-demandas"] = {
    iniciar() {
      el.lista = $("ldem-lista");
      el.busca = $("ldem-busca");
      el.status = $("ldem-status");
      el.prioridade = $("ldem-prioridade");
      el.ordenar = $("ldem-ordenar");
      el.contador = $("ldem-contador");
      el.vazio = $("ldem-vazio");
      el.modal = $("modal-demanda");
      el.form = $("form-editar-demanda");
      el.erro = $("modal-demanda-erro");
      el.salvar = $("modal-demanda-salvar");

      el.busca.addEventListener("input", () => renderizar());
      el.status.addEventListener("change", () => renderizar());
      el.prioridade.addEventListener("change", () => renderizar());
      el.ordenar.addEventListener("change", () => renderizar());

      el.form.addEventListener("submit", salvar);
      el.modal.querySelectorAll("[data-fechar]").forEach(b => b.addEventListener("click", fecharModal));
      el.modal.addEventListener("click", e => { if (e.target === el.modal) fecharModal(); }); // clique fora fecha
      el.modal.addEventListener("close", () => { idEmEdicao = null; });

      el.obsModal = $("modal-observacao");
      el.obsTexto = $("mo-texto");
      el.obsErro = $("modal-observacao-erro");
      el.obsSalvar = $("modal-observacao-salvar");
      $("form-observacao-demanda").addEventListener("submit", salvarObservacao);
      el.obsModal.querySelectorAll("[data-fechar]").forEach(b => b.addEventListener("click", () => el.obsModal.close()));
      el.obsModal.addEventListener("click", e => { if (e.target === el.obsModal) el.obsModal.close(); });
      el.obsModal.addEventListener("close", () => { idObservacao = null; });

      el.lista.addEventListener("click", e => {
        const botao = e.target.closest("button[data-acao]");
        if (!botao) return;
        const item = botao.closest(".cartao-item");
        const demanda = demandas.find(d => String(d.id) === item.dataset.id);
        if (!demanda) return;

        if (botao.dataset.acao === "detalhes") alternarDetalhes(botao, "Detalhes");
        if (botao.dataset.acao === "editar") abrirModal(demanda);
        if (botao.dataset.acao === "observacao") abrirObservacao(demanda);
        if (botao.dataset.acao === "cancelar") cancelar(botao, item, demanda);
      });
    },

    async aoEntrar() {
      el.contador.textContent = "Carregando demandas...";
      try {
        demandas = await AACD.api.listarDemandas();
        renderizar();
      } catch {
        demandas = [];
        el.lista.innerHTML = "";
        el.contador.textContent = "";
        el.vazio.textContent = "Erro ao carregar as demandas. Verifique se o backend está rodando.";
        el.vazio.classList.add("vazio--erro");
        el.vazio.hidden = false;
      }
    },

    // Ao sair da tela, o modal não pode ficar aberto
    aoSair() {
      if (el.modal && el.modal.open) fecharModal();
      if (el.obsModal && el.obsModal.open) el.obsModal.close();
    }
  };
})();
