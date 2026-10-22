/* =========================================================
   telas/pedidos-disponiveis.js — voluntário escolhe um pedido
   ========================================================= */
"use strict";

(() => {
  const { $, escapar, formatarData, mostrarToast, alternarDetalhes, listaDescricao } = AACD.util;
  const pesoPrioridade = { Alta: 3, "Média": 2, Baixa: 1 };
  let pedidos = [];

  const el = {};

  function filtrar() {
    const termo = el.busca.value.trim().toLowerCase();
    const prioridade = el.prioridade.value;

    const resultado = pedidos.filter(p => {
      const bateTexto = String(p.peca || "").toLowerCase().includes(termo) || String(p.id).includes(termo);
      const batePrioridade = prioridade === "todas" || p.prioridade === prioridade;
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

  async function aoClicarNaLista(e) {
    const botao = e.target.closest("button[data-acao]");
    if (!botao) return;
    const item = botao.closest(".cartao-item");
    const id = item.dataset.id;

    if (botao.dataset.acao === "detalhes") alternarDetalhes(botao, "Detalhes");

    if (botao.dataset.acao === "aceitar") {
      botao.disabled = true;
      botao.textContent = "Aceitando...";
      try {
        await AACD.api.aceitarDisponivel(id);
        item.classList.add("saindo");
        setTimeout(() => {
          pedidos = pedidos.filter(p => String(p.id) !== id);
          renderizar();
          mostrarToast(`Pedido #${id} aceito! Veja em "Pedidos aceitos".`);
        }, 300);
      } catch (erro) {
        botao.disabled = false;
        botao.textContent = "Aceitar";
        mostrarToast(erro.message, true);
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
