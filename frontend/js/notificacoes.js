"use strict";

AACD.notificacoes = (() => {
  const painel = document.getElementById("avisos-hub");
  const exibidos = new Set();
  let usuario, consultando, suprimir = false;

  function mostrar(aviso) {
    const caixa = document.createElement("div");
    caixa.className = "card aviso-hub";
    caixa.innerHTML = [
      '<div class="aviso-hub__cabecalho">',
      '<span class="aviso-hub__sinal" aria-hidden="true"></span>',
      '<strong></strong>',
      '<button type="button" class="btn-close" aria-label="Fechar aviso"></button>',
      '</div><div class="aviso-hub__conteudo"><p></p>',
      '<a class="btn btn-primary btn-sm"></a></div>'
    ].join("");
    const convite = aviso.link === "/voluntario/pedidos-disponiveis";
    caixa.querySelector("strong").textContent = convite ? "Convite de produção" : "Atualização de pedido";
    caixa.querySelector("a").textContent = convite ? "Ver pedidos disponíveis" : "Ver no Hub";
    caixa.querySelector("p").textContent = aviso.mensagem;
    const link = caixa.querySelector("a");
    link.href = "#" + aviso.link;
    link.onclick = () => caixa.remove();
    caixa.querySelector("button").onclick = () => caixa.remove();
    painel.append(caixa);
  }

  async function consultar() {
    const atual = usuario;
    if (!atual || consultando === atual || document.hidden || suprimir || document.querySelector("dialog[open]")) return;
    consultando = atual;
    try {
      const avisos = await AACD.api.listarNotificacoes();
      for (const aviso of avisos) {
        if (usuario !== atual || suprimir || document.hidden || document.querySelector("dialog[open]")) break;
        if (!exibidos.has(aviso.id)) {
          if (painel.childElementCount >= 3) break;
          mostrar(aviso);
          exibidos.add(aviso.id);
        }
        await AACD.api.confirmarNotificacao(aviso.id);
        exibidos.delete(aviso.id);
      }
    } catch { /* A próxima consulta tenta novamente. */ }
    finally { if (consultando === atual) consultando = null; }
  }

  function sessao(id) {
    if (usuario !== id) {
      usuario = id;
      painel.replaceChildren();
      exibidos.clear();
      suprimir = false;
    }
    consultar();
  }
  function preferencia(hub) {
    suprimir = !hub;
    if (hub) consultar();
    else painel.replaceChildren();
  }
  setInterval(consultar, 15000);
  document.addEventListener("visibilitychange", consultar);
  return { sessao, preferencia };
})();
