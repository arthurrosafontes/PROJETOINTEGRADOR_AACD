/* =========================================================
   telas/status-protese.js — funcionário vê as próteses separadas por
   status: Em produção, Aguardando validação e Concluídas.
   Segue o mesmo padrão visual das outras listas
   (abas-status + lista-cartoes + cartao-item + selo).
   ========================================================= */
"use strict";

(() => {
  const { $, escapar, formatarData, mostrarToast } = AACD.util;

  const STATUS = ["Em produção", "Aguardando validação", "Concluída"];

  let demandas = [];
  let statusSelecionado = "todos";
  const el = {};

  // "Aguardando validação" -> "aguardando-validacao" (para usar como classe CSS)
  const classeStatus = (status) => String(status || "").normalize("NFD")
    .replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, "-");

  const unidades = (n) => `${n ?? "-"} ${Number(n) === 1 ? "unidade" : "unidades"}`;

  function filtrar() {
    const termo = el.busca.value.trim().toLowerCase().replace(/^#/, "");
    return demandas.filter(d => {
      const pesquisa = [d.id, d.protese, d.nome, d.paciente].map(v => String(v ?? "").toLowerCase()).join(" ");
      const bateStatus = statusSelecionado === "todos" || d.status === statusSelecionado;
      return bateStatus && pesquisa.includes(termo);
    });
  }

  function atualizarContadores() {
    el.abas.querySelectorAll("[data-contador]").forEach(span => {
      const status = span.dataset.contador;
      span.textContent = status === "todos" ? demandas.length : demandas.filter(d => d.status === status).length;
    });
  }

  function renderizar() {
    const itens = filtrar();
    el.lista.innerHTML = itens.map(d => {
      const id = escapar(d.id);
      const status = classeStatus(d.status);
      return `
      <li class="card cartao-item cartao-item--faixa cartao-item--demanda-${status}" data-id="${id}">
        <article aria-labelledby="sp-titulo-${id}">
          <header class="cartao-item__titulo">
            <h2 id="sp-titulo-${id}">Demanda #${id} — ${escapar(d.protese || d.nome || "-")}</h2>
            <span class="badge rounded-pill selo selo--st-${status}">${escapar(d.status) || "-"}</span>
            ${d.prioridade ? `<span class="badge rounded-pill selo selo--${escapar(d.prioridade)}">${escapar(d.prioridade)}</span>` : ""}
          </header>
          ${d.nome && d.protese ? `<p class="cartao-item__subtitulo">${escapar(d.nome)}</p>` : ""}
          <p class="cartao-item__detalhes">
            ${d.paciente ? `<span>Paciente: <strong>${escapar(d.paciente)}</strong></span>` : ""}
            <span>Quantidade: <strong>${escapar(unidades(d.quantidade))}</strong></span>
            <span>Material: <strong>${escapar(d.material) || "-"}</strong></span>
            <span>Prazo: <strong>${d.prazo ? `<time datetime="${escapar(d.prazo)}">${formatarData(d.prazo)}</time>` : "-"}</strong></span>
          </p>
        </article>
      </li>`;
    }).join("");
    el.vazio.hidden = itens.length > 0;
  }

  function selecionarAba(botao) {
    statusSelecionado = botao.dataset.status;
    el.abas.querySelectorAll(".aba").forEach(b => b.setAttribute("aria-pressed", String(b === botao)));
    renderizar();
  }

  AACD.telas["tela-status-protese"] = {
    iniciar() {
      el.busca = $("sp-busca");
      el.abas = $("sp-abas");
      el.lista = $("sp-lista");
      el.vazio = $("sp-vazio");

      el.busca.addEventListener("input", renderizar);
      el.abas.addEventListener("click", (e) => {
        const botao = e.target.closest(".aba");
        if (botao) selecionarAba(botao);
      });
    },

    async aoEntrar() {
      try {
        const todas = await AACD.api.listarDemandas();
        demandas = todas.filter(d => STATUS.includes(d.status));
      } catch (erro) {
        demandas = [];
        mostrarToast(erro.message, true);
      }
      atualizarContadores();
      renderizar();
    }
  };
})();
