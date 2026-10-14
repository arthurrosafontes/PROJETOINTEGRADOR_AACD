/* ===== script.js — Tela Pedidos Aceitos (menu + lista) ===== */

/* =========================================================
   menu.js — abre/fecha os dropdowns do cabeçalho.
   Inclua em todas as páginas, antes de fechar o </body>.
   ========================================================= */
(function () {
  const itensMenu = [...document.querySelectorAll(".menu-item")].filter((item) =>
    item.querySelector(".submenu")
  );

  function fecharMenus(exceto) {
    itensMenu.forEach((item) => {
      if (item === exceto) return;
      item.classList.remove("aberto");
      item.querySelector(".menu-botao").setAttribute("aria-expanded", "false");
    });
  }

  itensMenu.forEach((item) => {
    const botao = item.querySelector(".menu-botao");
    const submenu = item.querySelector(".submenu");

    botao.addEventListener("click", (e) => {
      e.stopPropagation();
      const abrir = !item.classList.contains("aberto");
      fecharMenus(item);
      item.classList.toggle("aberto", abrir);
      botao.setAttribute("aria-expanded", String(abrir));
    });

    // Seta para baixo abre o menu e foca o primeiro link
    botao.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        fecharMenus(item);
        item.classList.add("aberto");
        botao.setAttribute("aria-expanded", "true");
        submenu.querySelector("a").focus();
      }
    });

    // Setas navegam entre os links
    submenu.addEventListener("keydown", (e) => {
      const links = [...submenu.querySelectorAll("a")];
      const i = links.indexOf(document.activeElement);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        links[(i + 1) % links.length].focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (i <= 0) botao.focus();
        else links[i - 1].focus();
      }
    });

    // Fecha quando o foco sai do item (Tab)
    item.addEventListener("focusout", (e) => {
      if (!item.contains(e.relatedTarget)) {
        item.classList.remove("aberto");
        botao.setAttribute("aria-expanded", "false");
      }
    });
  });

  // Clique fora fecha
  document.addEventListener("click", () => fecharMenus());

  // Esc fecha e devolve o foco ao botão
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const aberto = itensMenu.find((item) => item.classList.contains("aberto"));
    if (aberto) {
      fecharMenus();
      aberto.querySelector(".menu-botao").focus();
    }
  });

  // Marca automaticamente a página atual no dropdown
  const paginaAtual = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".submenu a").forEach((link) => {
    if (link.getAttribute("href") === paginaAtual) {
      link.setAttribute("aria-current", "page");
    }
  });
})();

/* =========================================================
   LISTA DA TELA "PEDIDOS ACEITOS"
   Depois troque o array "pedidos" por um fetch() para a API.
   ========================================================= */
(function () {
  const pedidos = [
    { id: 1024, paciente: "PAC-0842", produto: "Órtese de punho",     regiao: "Membro superior", aceite: "2026-10-09", status: "pendente",  material: "PLA",  tamanho: "M", prazo: "2026-10-20" },
    { id: 1025, paciente: "PAC-0917", produto: "Prótese ortopédica",  regiao: "Membro inferior", aceite: "2026-10-08", status: "producao",  material: "PETG", tamanho: "G", prazo: "2026-10-25" },
    { id: 1026, paciente: "PAC-0763", produto: "Palmilha ortopédica", regiao: "Apoio plantar",   aceite: "2026-10-06", status: "concluido", material: "TPU",  tamanho: "38", prazo: "2026-10-15" },
  ];

  // Texto que aparece para cada status
  const nomesStatus = { pendente: "Pendente", producao: "Em produção", concluido: "Concluído" };

  const lista = document.getElementById("lista");
  const busca = document.getElementById("busca");
  const vazio = document.getElementById("vazio");
  const toast = document.getElementById("toast");
  const filtros = document.querySelectorAll(".filtro");
  let statusEscolhido = "todos";

  // "2026-10-09" -> "09/10/2026"
  function formatarData(iso) {
    const [ano, mes, dia] = iso.split("-");
    return `${dia}/${mes}/${ano}`;
  }

  function mostrarAviso(msg) {
    toast.textContent = msg;
    toast.classList.add("visivel");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove("visivel"), 2500);
  }

  // Atualiza os números dentro dos botões de filtro
  function atualizarContagem() {
    filtros.forEach((botao) => {
      const s = botao.dataset.status;
      const total = s === "todos" ? pedidos.length : pedidos.filter((p) => p.status === s).length;
      botao.querySelector("span").textContent = total;
    });
  }

  // Texto e ação do botão principal, conforme o status
  function botaoPrincipal(p) {
    if (p.status === "pendente") return `<button type="button" class="btn btn-principal" data-acao="iniciar">Começar a produzir</button>`;
    if (p.status === "producao") return `<button type="button" class="btn btn-principal" data-acao="concluir">Marcar como concluído</button>`;
    return "";
  }

  function mostrarLista() {
    const termo = busca.value.trim().toLowerCase();

    const itens = pedidos.filter((p) => {
      const texto = `${p.id} ${p.produto} ${p.paciente}`.toLowerCase();
      const bateStatus = statusEscolhido === "todos" || p.status === statusEscolhido;
      return texto.includes(termo) && bateStatus;
    });

    lista.innerHTML = "";

    itens.forEach((p) => {
      const li = document.createElement("li");
      li.className = "item";
      li.dataset.id = p.id;
      li.innerHTML = `
        <div class="item-linha">
          <div class="item-texto">
            <p class="item-nome">Pedido #${p.id}</p>
            <p class="item-protese">${p.produto} · ${p.regiao}</p>
          </div>
          <div class="item-data">
            Aceito em ${formatarData(p.aceite)}
            <span class="status ${p.status}">${nomesStatus[p.status]}</span>
          </div>
          <button type="button" class="btn btn-detalhes" aria-expanded="false" aria-controls="det-${p.id}">
            Ver detalhes
          </button>
        </div>
        <div class="detalhes" id="det-${p.id}" hidden>
          <p><strong>Paciente:</strong> ${p.paciente}</p>
          <p><strong>Produto:</strong> ${p.produto} (${p.regiao})</p>
          <p><strong>Material:</strong> ${p.material}</p>
          <p><strong>Tamanho:</strong> ${p.tamanho}</p>
          <p><strong>Entregar até:</strong> ${formatarData(p.prazo)}</p>
          ${botaoPrincipal(p)}
        </div>
      `;
      lista.appendChild(li);
    });

    vazio.hidden = itens.length > 0;
    atualizarContagem();
  }

  // Clique nos botões de filtro
  filtros.forEach((botao) => {
    botao.addEventListener("click", () => {
      filtros.forEach((b) => {
        b.classList.remove("ativo");
        b.setAttribute("aria-pressed", "false");
      });
      botao.classList.add("ativo");
      botao.setAttribute("aria-pressed", "true");
      statusEscolhido = botao.dataset.status;
      mostrarLista();
    });
  });

  // Clique dentro da lista
  lista.addEventListener("click", (e) => {
    const item = e.target.closest(".item");
    if (!item) return;
    const pedido = pedidos.find((p) => p.id === Number(item.dataset.id));

    // Abrir / fechar detalhes
    if (e.target.closest(".btn-detalhes")) {
      const botao = item.querySelector(".btn-detalhes");
      const detalhes = item.querySelector(".detalhes");
      const abrir = detalhes.hidden;
      detalhes.hidden = !abrir;
      botao.textContent = abrir ? "Fechar" : "Ver detalhes";
      botao.setAttribute("aria-expanded", String(abrir));
      return;
    }

    // Mudar o status
    const acao = e.target.closest("[data-acao]");
    if (!acao) return;

    if (acao.dataset.acao === "iniciar") {
      pedido.status = "producao";
      mostrarAviso(`Pedido #${pedido.id} agora está em produção.`);
    }
    if (acao.dataset.acao === "concluir") {
      pedido.status = "concluido";
      mostrarAviso(`Pedido #${pedido.id} concluído!`);
    }
    mostrarLista();
  });

  busca.addEventListener("input", mostrarLista);

  mostrarLista();
})();