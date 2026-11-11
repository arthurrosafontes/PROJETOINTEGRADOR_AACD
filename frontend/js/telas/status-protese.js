/* =========================================================
   telas/status-protese.js — funcionário vê as próteses separadas por
   status: Em produção, Aguardando validação e Concluídas.
   Segue o mesmo padrão visual das outras listas
   (abas-status + lista-cartoes + cartao-item + selo).
   ========================================================= */
"use strict";

(() => {
  const { $, escapar, formatarData, mostrarToast } = AACD.util;

  const STATUS = ["Em produção", "Aguardando envio", "Aguardando validação", "Concluída", "Reprovada"];

  let demandas = [];
  let statusSelecionado = "todos";
  const el = {};
  let intervalo;
  let visita = 0;
  let carregando;

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
    }).sort((a, b) => STATUS.indexOf(a.status) - STATUS.indexOf(b.status) || Number(b.id) - Number(a.id));
  }

  function atualizarContadores() {
    el.abas.querySelectorAll("[data-contador]").forEach(span => {
      const status = span.dataset.contador;
      span.textContent = status === "todos" ? demandas.length : demandas.filter(d => d.status === status).length;
    });
  }

  function tabelaEtapa(titulo, linhas, vazio = "Sem registro.") {
    return `<div class="col-12 col-xl-4"><table class="table table-sm tabela-etapa">
      <caption class="caption-top">${titulo}</caption>
      <tbody>${linhas.length ? linhas.map(([rotulo, valor]) =>
        `<tr><th scope="row">${rotulo}</th><td>${valor || "—"}</td></tr>`).join("")
        : `<tr><td colspan="2">${vazio}</td></tr>`}</tbody>
    </table></div>`;
  }

  function renderizar() {
    const itens = filtrar();
    const abertos = new Set(Array.from(el.lista.querySelectorAll("details[open]"), d => d.closest("li").dataset.id));
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
        ${d.status === "Aguardando validação" && d.pedidoId ? '<div class="cartao-item__acoes"><button type="button" class="btn btn-primary botao" data-acao="receber">Receber</button></div>' : ""}
        ${AACD.material.cartao({id:d.pedidoId,materialAacd:d.materialAacd,status:d.status}, "funcionario")}
        ${d.pedidoId ? `<details class="cartao-item__extra d-block" ${abertos.has(id) ? "open" : ""}>
          <summary>Ver produção e avaliação</summary>
          <section class="etapas-pedido" aria-label="Etapas do pedido #${escapar(d.pedidoId)}">
            <div class="row g-3">
              ${tabelaEtapa("Aceito", [
                ["Pedido:", "#" + escapar(d.pedidoId)],
                ["Aceito por:", escapar(d.aceitoPor || "Nome indisponível")],
                ["Status atual:", escapar(d.status)]
              ])}
              ${tabelaEtapa("Impressão", AACD.conclusao.detalhes(d.conclusao), "Impressão ainda não finalizada.")}
              ${tabelaEtapa("Envio da peça", AACD.envio.detalhes(d.envio), "Envio ainda não registrado.")}
              ${d.recebimento ? tabelaEtapa("Recebimento e avaliação", AACD.recebimento.detalhes(d.recebimento)) : ""}
            </div>
          </section>
        </details>` : ""}
      </li>`;
    }).join("");
    el.vazio.hidden = itens.length > 0;
  }

  function selecionarAba(botao) {
    statusSelecionado = botao.dataset.status;
    el.abas.querySelectorAll(".aba").forEach(b => b.setAttribute("aria-pressed", String(b === botao)));
    renderizar();
  }

  async function atualizar(inicial = false) {
    const atual = visita;
    if (carregando === atual) return;
    carregando = atual;
    try {
      const todas = await AACD.api.listarDemandas();
      if (atual !== visita) return;
      const novas = todas.filter(d => STATUS.includes(d.status));
      if (!inicial && JSON.stringify(novas) === JSON.stringify(demandas)) return;
      demandas = novas;
      atualizarContadores();
      renderizar();
    } catch (erro) {
      if (inicial && atual === visita) {
        demandas = [];
        atualizarContadores();
        renderizar();
        mostrarToast(erro.message, true);
      }
    } finally { if (carregando === atual) carregando = undefined; }
  }
  function atualizarSeVisivel() {
    if (!document.hidden) atualizar();
  }

  AACD.telas["tela-status-protese"] = {
    iniciar() {
      el.busca = $("sp-busca");
      el.abas = $("sp-abas");
      el.lista = $("sp-lista");
      el.vazio = $("sp-vazio");

      el.lista.addEventListener("click", async e => {
        const botao = e.target.closest('[data-acao="receber"]');
        if (!botao) return;
        const demanda = demandas.find(d => String(d.id) === botao.closest(".cartao-item").dataset.id);
        const avaliacao = demanda && await AACD.recebimento.abrir(demanda);
        if (avaliacao) {
          demanda.status = avaliacao.demandaStatus;
          atualizarContadores();
          renderizar();
          mostrarToast(avaliacao.resultado === "Reprovada" ? "Peça recebida e reprovada. Motivo registrado." : "Peça recebida e aprovada. Pedido concluído.");
          await atualizar();
        }
      });

      el.busca.addEventListener("input", renderizar);
      el.abas.addEventListener("click", (e) => {
        const botao = e.target.closest(".aba");
        if (botao) selecionarAba(botao);
      });
    },

    async aoEntrar() {
      visita++;
      clearInterval(intervalo);
      intervalo = setInterval(atualizarSeVisivel, 10000);
      document.addEventListener("visibilitychange", atualizarSeVisivel);
      await atualizar(true);
    },
    aoSair() {
      visita++;
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", atualizarSeVisivel);
    }
  };
})();
