/* =========================================================
   telas/pedidos-aceitos.js — pedidos aceitos e recusados
   status: "Pendente" | "Em produção" | "Concluído" | "Recusado"
   ========================================================= */
"use strict";

(() => {
  const { $, escapar, formatarData, mostrarToast, confirmar, alternarDetalhes, listaDescricao } = AACD.util;

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

  function renderizar() {
    const itens = filtrar();
    el.lista.innerHTML = itens.map(p => {
      const id = escapar(p.id);
      // "Aceitar" e "Recusar" só aparecem nos pedidos pendentes
      return `
      <li class="cartao-item cartao-item--tres cartao-item--grande" data-id="${id}">
        <article aria-labelledby="pa-titulo-${id}">
          <h2 class="cartao-item__titulo" id="pa-titulo-${id}">Pedido #${id}</h2>
          <p class="cartao-item__subtitulo">${escapar(p.produto)} · ${escapar(p.categoria)}</p>
        </article>
        <p class="cartao-item__lateral">
          <span>Aceito em <time datetime="${escapar(p.aceito_em)}">${formatarData(p.aceito_em)}</time></span>
          <span class="selo selo--${classeStatus[p.status] || ""}">${escapar(p.status)}</span>
        </p>
        <div class="cartao-item__acoes">
          <button type="button" class="botao botao--secundario" data-acao="detalhes"
                  aria-expanded="false" aria-controls="pa-extra-${id}">Ver detalhes</button>
        </div>
        <div class="cartao-item__extra" id="pa-extra-${id}" hidden>
          ${listaDescricao([
            ["Produto:", escapar(p.produto)],
            ["Categoria:", escapar(p.categoria)],
            ["Material:", escapar(p.material)],
            ["Quantidade:", escapar(p.quantidade)],
            ["Impressora:", escapar(p.impressora)],
            ["Prazo:", `<time datetime="${escapar(p.prazo)}">${formatarData(p.prazo)}</time>`],
            ["Observações:", escapar(p.obs)]
          ])}
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
      el.busca = $("pa-busca");
      el.abas = $("pa-abas");
      el.vazio = $("pa-vazio");

      el.busca.addEventListener("input", renderizar);
      el.abas.addEventListener("click", e => {
        const aba = e.target.closest(".aba");
        if (aba) selecionarStatus(aba.dataset.status);
      });

el.lista.addEventListener("click", e => {
  const botao = e.target.closest("button[data-acao]");
  if (!botao) return;

  if (botao.dataset.acao === "detalhes") {
    alternarDetalhes(botao, "Ver detalhes");
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
