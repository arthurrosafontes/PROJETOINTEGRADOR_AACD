/* =========================================================
   roteador.js — transforma o index.html numa SPA
   ---------------------------------------------------------
   Cada tela é um <main data-rota="..."> no index.html.
   O endereço usa "#/" (ex.: index.html#/voluntario/producao),
   então funciona em qualquer servidor estático, sem configuração.

   Atributos de cada <main>:
     data-rota     -> uma ou mais rotas separadas por espaço
     data-subrotas -> aceita trechos extras (ex.: /voluntario/producao/concluidas)
     data-area     -> "publica", "voluntario", "funcionario" ou "auto"
     data-titulo   -> texto da aba do navegador

   Cada tela pode registrar em AACD.telas["id-do-main"]:
     iniciar()                -> roda uma vez, na primeira visita
     aoEntrar(parametros, rota) -> roda a cada visita
     aoSair()                 -> roda quando o usuário sai da tela
   ========================================================= */
"use strict";

(() => {
  const { $, sessao } = AACD.util;
  const NOME_SISTEMA = "Hub AACD";
  const telas = [...document.querySelectorAll("main[data-rota]")];
  const iniciadas = new Set();
  let telaAtual = null;
  let primeiraNavegacao = true;

  const barra = $("barra");
  const menu = $("menu-principal");
  const botaoMenu = $("alternar-menu");

  // ===== Descobre qual tela corresponde ao endereço =====
  function lerEndereco() {
    const bruto = decodeURIComponent(location.hash.replace(/^#/, ""));
    const caminho = "/" + bruto.replace(/^\/+|\/+$/g, "");
    return caminho;
  }

  function encontrarTela(caminho) {
    for (const tela of telas) {
      for (const rota of tela.dataset.rota.split(/\s+/)) {
        if (rota === caminho) return { tela, rota, parametros: [] };
        if ("subrotas" in tela.dataset && caminho.startsWith(rota + "/")) {
          return { tela, rota, parametros: caminho.slice(rota.length + 1).split("/") };
        }
      }
    }
    return null;
  }

  // ===== Barra de navegação =====
  function fecharSubmenus(exceto = null) {
    barra.querySelectorAll('.menu__botao[aria-expanded="true"]').forEach(botao => {
      if (botao === exceto) return;
      botao.setAttribute("aria-expanded", "false");
      $(botao.getAttribute("aria-controls")).hidden = true;
    });
  }

  function fecharMenuCelular() {
    menu.classList.remove("aberto");
    botaoMenu.setAttribute("aria-expanded", "false");
    botaoMenu.querySelector(".visualmente-oculto").textContent = "Abrir menu principal";
  }

  function configurarBarra(area, caminho) {
    barra.hidden = area === "publica";
    if (barra.hidden) return;

    // Menu do perfil certo
    menu.querySelectorAll("[data-perfil]").forEach(lista => { lista.hidden = lista.dataset.perfil !== area; });
    $("barra-logo").href = `#/${area}`;
    barra.querySelectorAll("[data-link-area]").forEach(link => { link.href = `#/${area}/em-construcao`; });

    // Nome e cargo do usuário logado
    const usuario = sessao.obter();
    $("usuario-nome").textContent = usuario && usuario.nome ? usuario.nome : "Usuário";
    $("usuario-cargo").textContent = area === "funcionario" ? "Funcionário" : "Voluntário";

    // Marca o link da página atual (as páginas "em construção" não são marcadas)
    barra.querySelectorAll("a[href^='#/']").forEach(link => {
      const destino = link.getAttribute("href").slice(1);
      const atual = !destino.endsWith("/em-construcao") && destino !== `/${area}`
        && (caminho === destino || caminho.startsWith(destino + "/"));
      if (atual) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    fecharSubmenus();
    fecharMenuCelular();
  }

  function prepararBarra() {
    // Abre/fecha submenus (padrão "disclosure": botão + lista)
    barra.addEventListener("click", (e) => {
      const botao = e.target.closest(".menu__botao");
      if (!botao) return;
      e.stopPropagation();
      const abrir = botao.getAttribute("aria-expanded") !== "true";
      fecharSubmenus(botao);
      botao.setAttribute("aria-expanded", String(abrir));
      $(botao.getAttribute("aria-controls")).hidden = !abrir;
    });

    // Clique fora ou tecla Esc fecham os submenus
    document.addEventListener("click", (e) => {
      if (!barra.contains(e.target)) { fecharSubmenus(); fecharMenuCelular(); }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const aberto = barra.querySelector('.menu__botao[aria-expanded="true"]');
      if (aberto) { fecharSubmenus(); aberto.focus(); }
    });

    // Menu do celular
    botaoMenu.addEventListener("click", (e) => {
      e.stopPropagation();
      const abrir = !menu.classList.contains("aberto");
      menu.classList.toggle("aberto", abrir);
      botaoMenu.setAttribute("aria-expanded", String(abrir));
      botaoMenu.querySelector(".visualmente-oculto").textContent = abrir ? "Fechar menu principal" : "Abrir menu principal";
    });

    // Sair: encerra a sessão no servidor (se ele estiver no ar) e volta ao início
    $("botao-sair").addEventListener("click", async () => {
      try { await AACD.api.logout(); } catch { /* servidor fora do ar: sai mesmo assim */ }
      sessao.limpar();
      location.hash = "#/";
    });
  }

  // ===== Troca de tela =====
  function navegar() {
    const caminho = lerEndereco();
    const encontrada = encontrarTela(caminho) || { tela: $("tela-nao-encontrada"), rota: "/404", parametros: [] };
    const { tela, rota, parametros } = encontrada;
    const mesmaTela = tela === telaAtual;
    parametros.trocaInterna = mesmaTela;

    // Sai da tela anterior
    if (telaAtual && !mesmaTela) {
      const anterior = AACD.telas[telaAtual.id];
      if (anterior && anterior.aoSair) anterior.aoSair();
    }
    // Esconde todas as outras (inclusive a tela inicial, que vem visível no HTML)
    telas.forEach(t => { if (t !== tela) t.hidden = true; });

    // Área da tela ("auto" = descobre pelo começo do endereço)
    let area = tela.dataset.area;
    if (area === "auto") area = caminho.startsWith("/funcionario") ? "funcionario" : "voluntario";
    document.body.dataset.area = area;
    configurarBarra(area, caminho);

    if (tela.id === "tela-em-construcao") $("em-construcao-voltar").href = `#/${area}`;

    tela.hidden = false;
    telaAtual = tela;
    document.title = `${tela.dataset.titulo} — ${NOME_SISTEMA}`;

    // Inicializa a tela na primeira visita e avisa a cada entrada
    const controlador = AACD.telas[tela.id];
    if (controlador) {
      if (!iniciadas.has(tela.id) && controlador.iniciar) {
        controlador.iniciar();
        iniciadas.add(tela.id);
      }
      if (controlador.aoEntrar) controlador.aoEntrar(parametros, caminho);
    }

    // Leva o foco ao título da nova tela (importante para leitores de tela)
    if (!primeiraNavegacao && !mesmaTela) {
      window.scrollTo(0, 0);
      const titulo = tela.querySelector("h1");
      if (titulo) titulo.focus({ preventScroll: true });
    }
    primeiraNavegacao = false;
  }

  // "Pular para o conteúdo" leva o foco ao título da tela visível
  $("pular-conteudo").addEventListener("click", (e) => {
    e.preventDefault();
    const titulo = telaAtual && telaAtual.querySelector("h1");
    if (titulo) titulo.focus();
  });

  prepararBarra();
  window.addEventListener("hashchange", navegar);
  navegar();
})();
