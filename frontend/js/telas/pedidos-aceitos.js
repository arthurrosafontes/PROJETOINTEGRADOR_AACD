/* =========================================================
   telas/pedidos-aceitos.js — pedidos aceitos e recusados
   status: "Pendente" | "Em produção" | "Concluído" | "Recusado"
   ========================================================= */
"use strict";

(() => {
  const {
  $,
  escapar,
  formatarData,
  formatarDataHora,
  mostrarToast,
  confirmar,
  alternarDetalhes,
  listaDescricao
} = AACD.util;

const classeStatus = {
  "Aceito": "pendente",
  "Em produção": "producao",
  "Aguardando envio": "pendente",
  "Aguardando validação": "pendente",
  "Concluído": "concluido",
  "Reprovado": "recusado",
  "Cancelado": "recusado"
};

  let pedidos = [];
  let statusSelecionado = "todos";
  const el = {};

  function filtrar() {
    const termo = el.busca.value.trim().toLowerCase();
    return pedidos.filter(p => {
      const bateTexto = String(p.id).includes(termo)
        || String(p.produto || "").toLowerCase().includes(termo)
        || String(p.categoria || "").toLowerCase().includes(termo);
      const bateStatus = statusSelecionado === "todos" || p.status === statusSelecionado;
      return bateTexto && bateStatus;
    });
  }

  function atualizarContadores() {
    el.abas.querySelectorAll("[data-contador]").forEach(span => {
      const status = span.dataset.contador;
      span.textContent = status === "todos" ? pedidos.length : pedidos.filter(p => p.status === status).length;
    });
  }


  function tabelaEtapa(titulo, linhas, vazio) {
    const corpo = linhas.map(([rotulo, valor]) =>
      `<tr><th scope="row">${rotulo}</th><td>${valor || "—"}</td></tr>`).join("");
    return `<div class="col-12 col-xl-4"><table class="table table-sm tabela-etapa">
      <caption class="caption-top">${titulo}</caption>
      <tbody>${corpo || `<tr><td colspan="2">${vazio}</td></tr>`}</tbody>
    </table></div>`;
  }

  function etapasPedido(p) {
    const aceite = [
      ["Pedido:", `#${escapar(p.id)}`],
      ["Demanda:", `#${escapar(p.demandaId)}`],
      ["Aceito em:", escapar(p.dataAceiteUTC ? formatarDataHora(p.dataAceiteUTC) : formatarData(p.aceito_em))],
      ["Status atual:", escapar(p.status)],
      ["Impressora:", escapar(p.impressora)],
      ["Doação de material:", ({ 1: "Sim", 0: "Não" })[p.doacaoMaterial] ?? "Não informado"]
    ];
    const impressao = [
      ["Início da produção:", p.dataInicioUTC ? escapar(formatarDataHora(p.dataInicioUTC)) : "Produção ainda não iniciada"],
      ...AACD.conclusao.detalhes(p.conclusao)
    ];
    if (!p.conclusao) impressao.push(["Conclusão:", "Sem registro de conclusão."]);
    return `<section class="etapas-pedido">
      <h3>Etapas do pedido</h3><div class="row g-3">
        ${tabelaEtapa("Aceito", aceite)}
        ${tabelaEtapa("Impressão", impressao)}
        ${tabelaEtapa("Envio da peça", AACD.envio.detalhes(p.envio), "Sem registro de envio.")}
        ${tabelaEtapa("Recebimento e avaliação", AACD.recebimento.detalhes(p.recebimento), "Sem registro de recebimento e avaliação.")}
      </div>
    </section>`;
  }

  function renderizar() {
    const itens = filtrar();
    el.lista.innerHTML = itens.map(p => {
      const id = escapar(p.id);
      // "Aceitar" e "Recusar" só aparecem nos pedidos pendentes
      return `
      <li class="card cartao-item cartao-item--tres cartao-item--grande" data-id="${id}">
        <article aria-labelledby="pa-titulo-${id}">
          <h2 class="cartao-item__titulo" id="pa-titulo-${id}">Pedido #${id} · Demanda #${escapar(p.demandaId)}</h2>
          <p class="cartao-item__subtitulo">${escapar(p.produto)} · ${escapar(p.categoria)}</p>
        </article>
        <p class="cartao-item__lateral">
          <span>
  Aceito em
  <time datetime="${escapar(p.dataAceiteUTC || "")}">
    ${p.dataAceiteUTC
      ? formatarDataHora(p.dataAceiteUTC)
      : formatarData(p.aceito_em)}
  </time>
</span>
          <span class="badge rounded-pill selo selo--${classeStatus[p.status] || ""}">${escapar(p.status)}</span>
        </p>
        <div class="cartao-item__acoes">
          ${p.status === "Aguardando envio" ? '<button type="button" class="btn btn-primary botao" data-acao="envio">Registrar envio</button>' : ""}
          ${p.status === "Em produção" ? '<button type="button" class="btn btn-primary botao" data-acao="finalizar">Finalizar impressão</button>' : ""}
        ${p.status === "Aceito" && !AACD.material.bloqueado(p) ? `
  <button type="button"
          class="btn btn-primary botao botao--primario"
          data-acao="iniciar-producao">
    Iniciar produção
  </button>
` : ""}
          <button type="button" class="btn btn-outline-primary botao botao--secundario" data-acao="detalhes"
                  aria-expanded="false" aria-controls="pa-extra-${id}">Ver detalhes</button>
        </div>
        ${AACD.material.cartao(p, "voluntario")}
        <div class="cartao-item__extra flex-column align-items-stretch" id="pa-extra-${id}" hidden>
          <div class="row g-3">
            <section class="col-12 col-xl-4" aria-label="Identificação">
              <h3 class="h6 text-primary">Identificação</h3>
              ${listaDescricao([
                ["Nome:", escapar(p.demanda?.nome || p.produto)],
                ["Prótese:", escapar([p.demanda?.codigo, p.produto].filter(Boolean).join(" — "))],
                ["Tipo:", escapar(p.categoria)],
                ["Região:", escapar(p.demanda?.regiao)],
                ["Paciente:", escapar(p.demanda?.paciente)],
                ["Cadastro:", p.demanda?.cadastro ? formatarData(p.demanda.cadastro) : "—"],
                ["Descrição:", escapar(p.descricao || "Não informada")]
              ])}
            </section>
            <section class="col-12 col-xl-4" aria-label="Especificações">
              <h3 class="h6 text-primary">Especificações</h3>
              ${listaDescricao([
                ["Quantidade:", escapar(p.quantidade)],
                ["Material:", escapar(p.material)],
                ["Bico:", p.diametroBico == null ? "—" : escapar(p.diametroBico) + " mm"],
                ["Dimensões:", [p.largura, p.profundidade, p.altura].every(v => v != null) ? escapar(p.largura + " × " + p.profundidade + " × " + p.altura) + " mm" : "Não informadas"],
                ["Tempo estimado:", p.tempoHoras == null ? "—" : escapar(p.tempoHoras) + " horas"],
                ["Altura da camada:", p.alturaCamada == null ? "—" : escapar(p.alturaCamada) + " mm"],
                ["Preenchimento:", p.infill == null ? "—" : escapar(p.infill) + "%"],
                ["Necessita suporte:", p.necessitaSuporte ? "Sim" : "Não"],
                ["Orientações de impressão:", escapar(p.orientacoes || "Não informadas")],
                ["Observações:", escapar(p.demanda?.observacoes ?? p.obs)],
                ["Arquivo 3D:", p.possuiArquivo3d ? `<button type="button" class="btn btn-primary botao" data-acao="baixar-arquivo" data-id="${id}">Baixar arquivo 3D</button>` : "Arquivo ainda não disponibilizado pela AACD."]
              ])}
            </section>
            <section class="col-12 col-xl-4" aria-label="Entrega prevista">
              <h3 class="h6 text-primary">Entrega prevista</h3>
              ${listaDescricao([
                ["Prazo:", formatarData(p.prazo)],
                ["Forma:", escapar(p.demanda?.formaEntrega || p.formaEntrega)],
                ["Local:", escapar(p.demanda?.localEntrega)],
                ["Responsável:", escapar(p.demanda?.responsavel)],
                ["Instruções:", escapar(p.demanda?.instrucoes)]
              ])}
            </section>
          </div>
          ${etapasPedido(p)}
        </div>
      </li>`;
    }).join("");

    el.vazio.classList.remove("vazio--erro");
    el.vazio.textContent = "Nenhum pedido encontrado.";
    el.vazio.hidden = itens.length > 0;
    atualizarContadores();
  }

  function selecionarStatus(status) {
    statusSelecionado = status;
    el.abas.querySelectorAll(".aba").forEach(a => a.setAttribute("aria-pressed", String(a.dataset.status === status)));
    renderizar();
  }

  AACD.telas["tela-pedidos-aceitos"] = {
    iniciar() {
      el.lista = $("pa-lista");
      document.addEventListener("material-atualizado", async () => {
        if ($("tela-pedidos-aceitos").hidden) return;
        try { pedidos = await AACD.api.listarPedidos(); renderizar(); } catch (e) { mostrarToast(e.message, true); }
      });
      el.busca = $("pa-busca");
      el.abas = $("pa-abas");
      el.vazio = $("pa-vazio");

      el.busca.addEventListener("input", renderizar);
      el.abas.addEventListener("click", e => {
        const aba = e.target.closest(".aba");
        if (aba) selecionarStatus(aba.dataset.status);
      });

el.lista.addEventListener("click", async e => {
  const botao = e.target.closest("button[data-acao]");
  if (!botao) return;

  if (botao.dataset.acao === "envio") {
    const pedido = pedidos.find(p => String(p.id) === botao.closest(".cartao-item").dataset.id);
    if (pedido && await AACD.envio.abrir(pedido)) {
      pedido.status = "Aguardando validação";
      mostrarToast("Envio registrado. O pedido aguarda validação pela AACD.");
      try { pedidos = await AACD.api.listarPedidos(); }
      catch { mostrarToast("Envio salvo. Reabra a lista para atualizar os detalhes.", true); }
      selecionarStatus("Aguardando validação");
    }
    return;
  }
  if (botao.dataset.acao === "finalizar") {
    const pedido = pedidos.find(p => String(p.id) === botao.closest(".cartao-item").dataset.id);
    if (pedido && await AACD.conclusao.abrir(pedido)) {
      pedido.status = "Aguardando envio";
      selecionarStatus("Aguardando envio");
      mostrarToast("Impressão finalizada. O pedido está aguardando envio.");
      try { pedidos = await AACD.api.listarPedidos(); renderizar(); }
      catch { mostrarToast("Conclusão salva. Reabra a lista para atualizar os detalhes.", true); }
    }
    return;
  }

  if (botao.dataset.acao === "detalhes") {
    alternarDetalhes(botao, "Ver detalhes");
    return;
  }

  if (botao.dataset.acao === "baixar-arquivo") {
    const id = botao.dataset.id;

    botao.disabled = true;
    const textoOriginal = botao.textContent;
    botao.textContent = "Baixando...";

    try {
      await AACD.api.baixarArquivo3d(id);
    } catch (erro) {
      mostrarToast(erro.message, true);
    } finally {
      botao.disabled = false;
      botao.textContent = textoOriginal;
    }
  }
  if (botao.dataset.acao === "iniciar-producao") {
  const id = botao.closest(".cartao-item").dataset.id;

  if (!confirm("Deseja iniciar a produção deste pedido?")) {
    return;
  }

  botao.disabled = true;
  botao.textContent = "Iniciando...";

  try {
    await AACD.api.iniciarProducao(id);

    pedidos = await AACD.api.listarPedidos();
    renderizar();

    mostrarToast("Produção iniciada com sucesso!");

  } catch (erro) {
    botao.disabled = false;
    botao.textContent = "Iniciar produção";
    mostrarToast(erro.message, true);
  }
}
});

    },

    async aoEntrar() {
      try {
        pedidos = await AACD.api.listarPedidos();
        renderizar();
      } catch {
        pedidos = [];
        el.lista.innerHTML = "";
        atualizarContadores();
        el.vazio.textContent = "Erro ao carregar os pedidos. Verifique se o backend está rodando.";
        el.vazio.classList.add("vazio--erro");
        el.vazio.hidden = false;
      }
    }
  };
})();
