/* =========================================================
   telas/pedidos-disponiveis.js — voluntário escolhe um pedido
   ========================================================= */
"use strict";

(() => {
  const { $, escapar, formatarData, mostrarToast, alternarDetalhes, listaDescricao } = AACD.util;
  const pesoPrioridade = { Urgente: 4, Alta: 3, Normal: 2, Baixa: 1 };
  let pedidos = [];

  const el = {};

  function filtrar() {
    const termo = el.busca.value.trim().toLowerCase();
    const prioridade = el.prioridade.value;

    const resultado = pedidos.filter(p => {
      const bateTexto = String(p.peca || "").toLowerCase().includes(termo) || String(p.id).includes(termo);
      const batePrioridade =
      prioridade === "todas" ||
      String(p.prioridade || "").trim().toLowerCase() ===
      prioridade.trim().toLowerCase();
      return bateTexto && batePrioridade;
    });

    const criado = (p) => String(p.criado || "");
    if (el.ordenar.value === "recentes") resultado.sort((a, b) => criado(b).localeCompare(criado(a)));
    if (el.ordenar.value === "antigos") resultado.sort((a, b) => criado(a).localeCompare(criado(b)));
    if (el.ordenar.value === "prioridade") resultado.sort((a, b) => (pesoPrioridade[b.prioridade] || 0) - (pesoPrioridade[a.prioridade] || 0));
    return resultado;
  }

  function renderizar() {
    const itens = filtrar();
    el.lista.innerHTML = itens.map(p => `
      <li class="cartao-item cartao-item--faixa" data-id="${escapar(p.id)}">
        <article aria-labelledby="pd-titulo-${escapar(p.id)}">
          <header class="cartao-item__titulo">
            <h2 id="pd-titulo-${escapar(p.id)}">${escapar(p.peca)}</h2>
            <span class="selo selo--${escapar(p.prioridade)}">Prioridade ${escapar(p.prioridade)}</span>
            <span class="cartao-item__codigo">#${escapar(p.id)}</span>
          </header>
          <p class="cartao-item__detalhes">
            <span>Material: <strong>${escapar(p.material)}</strong></span>
            <span>Qtd: <strong>${escapar(p.quantidade)}</strong></span>
            <span>Tempo estimado: <strong>${escapar(p.tempo)}</strong></span>
            <span>Prazo: <strong><time datetime="${escapar(p.prazo)}">${formatarData(p.prazo)}</time></strong></span>
          </p>
        </article>
        <div class="cartao-item__acoes">
          <button type="button" class="botao botao--secundario" data-acao="detalhes"
                  aria-expanded="false" aria-controls="pd-extra-${escapar(p.id)}">Detalhes</button>
          <button type="button" class="botao botao--primario" data-acao="aceitar">Aceitar</button>
        </div>
        <div class="cartao-item__extra" id="pd-extra-${escapar(p.id)}" hidden>
          ${listaDescricao([
            ["Observações:", escapar(p.obs)],
            ["Criado em:", `<time datetime="${escapar(p.criado)}">${formatarData(p.criado)}</time>`]
          ])}
        </div>
      </li>`).join("");

    el.contador.textContent = `${itens.length} pedido(s) disponível(is)`;
    el.vazio.textContent = "Nenhum pedido encontrado.";
    el.vazio.classList.remove("vazio--erro");
    el.vazio.hidden = itens.length > 0;
  }

  // Modal criado por JavaScript: não exige alterações no index.html.
function obterDialogo() {
    let dialogo = document.getElementById("pd-dialogo-impressora");
    if (dialogo) return dialogo;

    dialogo = document.createElement("dialog");
    dialogo.id = "pd-dialogo-impressora";
    dialogo.setAttribute("aria-labelledby", "pd-dialogo-titulo");

    dialogo.innerHTML = `
      <form method="dialog" id="pd-form-impressora">
        <h2 id="pd-dialogo-titulo">Escolher impressora</h2>
        <p id="pd-dialogo-resumo"></p>

        <label for="pd-dialogo-select">
          Impressora para produzir o pedido
        </label>

        <select id="pd-dialogo-select" required></select>

        <div class="pd-dialogo-acoes">
          <button type="button"
                  class="botao botao--secundario"
                  id="pd-dialogo-cancelar">
            Cancelar
          </button>

          <button type="submit"
                  class="botao botao--primario"
                  id="pd-dialogo-confirmar">
            Confirmar aceite
          </button>
        </div>
      </form>`;

    document.body.appendChild(dialogo);

    dialogo.querySelector("#pd-dialogo-cancelar")
      .addEventListener("click", () => dialogo.close());

    return dialogo;
}

  async function escolherImpressora(pedido) {
    const impressoras = await AACD.api.listarMinhasImpressoras();
    if (!Array.isArray(impressoras) || impressoras.length === 0) {
      mostrarToast("Você precisa cadastrar uma impressora antes de aceitar um pedido.", true);
      return null;
    }

    const dialogo = obterDialogo();
    const seletor = dialogo.querySelector("#pd-dialogo-select");
    const resumo = dialogo.querySelector("#pd-dialogo-resumo");
    resumo.textContent = `Pedido #${pedido.id} — ${pedido.peca} (${pedido.material}; ${pedido.quantidade} unidade(s))`;
    seletor.replaceChildren(new Option("Selecione uma impressora", ""));

    impressoras.forEach(i => {
      const nome = i.nome_da_impressora || i.modelo_da_impressora || "Impressora";
      const modelo = i.modelo_da_impressora ? ` — ${i.modelo_da_impressora}` : "";
      seletor.add(new Option(`${nome}${modelo}`, String(i._id)));
    });

    return new Promise(resolve => {
      const formulario = dialogo.querySelector("#pd-form-impressora");
      const confirmar = dialogo.querySelector("#pd-dialogo-confirmar");
      confirmar.disabled = false;
      const aoEnviar = e => {
        e.preventDefault();
        if (!seletor.value) { seletor.reportValidity(); return; }
        dialogo.close();
        resolve(seletor.value);
      };
      const aoFechar = () => {
        formulario.removeEventListener("submit", aoEnviar);
        dialogo.removeEventListener("close", aoFechar);
        resolve(null);
      };
      formulario.addEventListener("submit", aoEnviar);
      dialogo.addEventListener("close", aoFechar);
      dialogo.showModal();
    });
  }

  async function aoClicarNaLista(e) {
    const botao = e.target.closest("button[data-acao]");
    if (!botao) return;
    const item = botao.closest(".cartao-item");
    const id = item.dataset.id;

    if (botao.dataset.acao === "detalhes") {
      alternarDetalhes(botao, "Detalhes");
      return;
    }

    if (botao.dataset.acao === "aceitar") {
      const pedido = pedidos.find(p => String(p.id) === id);
      if (!pedido) return;
      botao.disabled = true;
      botao.textContent = "Carregando impressoras...";
      try {
        const idImpressora = await escolherImpressora(pedido);
        if (!idImpressora) return;
        botao.textContent = "Aceitando...";
        // Passo seguinte: implementar essa rota no backend com transação MySQL.
        await AACD.api.aceitarDisponivel(id, idImpressora);
        item.classList.add("saindo");
        setTimeout(() => {
          pedidos = pedidos.filter(p => String(p.id) !== id);
          renderizar();
          mostrarToast(`Pedido #${id} aceito! Veja em "Pedidos aceitos".`);
        }, 300);
      } catch (erro) {
        mostrarToast(erro.message, true);
      } finally {
        botao.disabled = false;
        botao.textContent = "Aceitar";
      }
    }
  }

  AACD.telas["tela-pedidos-disponiveis"] = {
    iniciar() {
      el.lista = $("pd-lista");
      el.busca = $("pd-busca");
      el.prioridade = $("pd-prioridade");
      el.ordenar = $("pd-ordenar");
      el.contador = $("pd-contador");
      el.vazio = $("pd-vazio");

      el.lista.addEventListener("click", aoClicarNaLista);
      el.busca.addEventListener("input", renderizar);
      el.prioridade.addEventListener("change", renderizar);
      el.ordenar.addEventListener("change", renderizar);
    },

    // Recarrega da API sempre que a tela é aberta
    async aoEntrar() {
      el.contador.textContent = "Carregando pedidos...";
      try {
        pedidos = await AACD.api.listarDisponiveis();
        renderizar();
      } catch (erro) {
        pedidos = [];
        el.lista.innerHTML = "";
        el.contador.textContent = "";
        el.vazio.textContent = "Erro ao carregar os pedidos. Verifique se o backend está rodando.";
        el.vazio.classList.add("vazio--erro");
        el.vazio.hidden = false;
      }
    }
  };
})();
