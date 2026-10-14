/* ===== script.js — Tela Em Produção (menu + lista) ===== */

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
   em-producao.js — lista da tela "Em Produção".
   Depois troque o array "pecas" por um fetch() para a API.
   ========================================================= */
(function () {
  const pecas = [
    { id: 1012, paciente: "Ana Lima",       protese: "Prótese de dedo",      prazo: "2026-10-05", material: "PLA",  cor: "Bege",  tamanho: "M", obs: "Falta lixar as articulações." },
    { id: 1014, paciente: "Beatriz Rocha",  protese: "Prótese de mão",       prazo: "2026-10-08", material: "PETG", cor: "Azul",  tamanho: "P", obs: "Falta imprimir a palma." },
    { id: 1016, paciente: "João Pereira",   protese: "Prótese de antebraço", prazo: "2026-10-12", material: "PLA",  cor: "Preto", tamanho: "G", obs: "Imprimir em 2 partes." },
    { id: 1017, paciente: "Maria Souza",    protese: "Prótese de mão",       prazo: "2026-10-30", material: "PLA",  cor: "Rosa",  tamanho: "P", obs: "Nenhuma." },
    { id: 1018, paciente: "Lucas Oliveira", protese: "Prótese de braço",     prazo: "2026-11-02", material: "PETG", cor: "Cinza", tamanho: "G", obs: "Imprimir em 3 partes." },
    { id: 1019, paciente: "Carlos Mendes",  protese: "Órtese de punho",      prazo: "2026-11-15", material: "TPU",  cor: "Preto", tamanho: "G", obs: "Usar material flexível." },
  ];

  const lista = document.getElementById("lista");
  const busca = document.getElementById("busca");
  const vazio = document.getElementById("vazio");
  const toast = document.getElementById("toast");

  // "2026-10-05" -> "05/10/2026"
  function formatarData(iso) {
    const [ano, mes, dia] = iso.split("-");
    return `${dia}/${mes}/${ano}`;
  }

  // Texto simples: "Atrasado 5 dias" ou "Faltam 20 dias"
  function situacao(iso) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const [ano, mes, dia] = iso.split("-").map(Number);
    const dias = Math.round((new Date(ano, mes - 1, dia) - hoje) / 86400000);

    if (dias < 0) return { classe: "atrasado", texto: `Atrasado ${-dias} dia${dias === -1 ? "" : "s"}` };
    if (dias === 0) return { classe: "atrasado", texto: "Entregar hoje" };
    return { classe: "no-prazo", texto: `Faltam ${dias} dia${dias === 1 ? "" : "s"}` };
  }

  function mostrarAviso(msg) {
    toast.textContent = msg;
    toast.classList.add("visivel");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove("visivel"), 2500);
  }

  function mostrarLista() {
    const termo = busca.value.trim().toLowerCase();
    const itens = pecas
      .filter((p) => p.paciente.toLowerCase().includes(termo))
      .sort((a, b) => a.prazo.localeCompare(b.prazo)); // prazo mais próximo primeiro

    lista.innerHTML = "";

    itens.forEach((p) => {
      const s = situacao(p.prazo);
      const li = document.createElement("li");
      li.className = "item";
      li.dataset.id = p.id;
      li.innerHTML = `
        <div class="item-linha">
          <div class="item-texto">
            <p class="item-nome">${p.paciente}</p>
            <p class="item-protese">${p.protese}</p>
          </div>
          <div class="item-prazo">
            Entrega: ${formatarData(p.prazo)}
            <span class="${s.classe}">${s.texto}</span>
          </div>
          <button type="button" class="btn btn-detalhes" aria-expanded="false" aria-controls="det-${p.id}">
            Ver detalhes
          </button>
        </div>
        <div class="detalhes" id="det-${p.id}" hidden>
          <p><strong>Pedido:</strong> #${p.id}</p>
          <p><strong>Material:</strong> ${p.material} (${p.cor})</p>
          <p><strong>Tamanho:</strong> ${p.tamanho}</p>
          <p><strong>Observação:</strong> ${p.obs}</p>
          <button type="button" class="btn btn-concluir">Marcar como pronto</button>
        </div>
      `;
      lista.appendChild(li);
    });

    vazio.hidden = itens.length > 0;
  }

  lista.addEventListener("click", (e) => {
    const item = e.target.closest(".item");
    if (!item) return;

    // Abrir / fechar detalhes
    if (e.target.closest(".btn-detalhes")) {
      const botao = item.querySelector(".btn-detalhes");
      const detalhes = item.querySelector(".detalhes");
      const abrir = detalhes.hidden;
      detalhes.hidden = !abrir;
      botao.textContent = abrir ? "Fechar" : "Ver detalhes";
      botao.setAttribute("aria-expanded", String(abrir));
    }

    // Marcar como pronto
    if (e.target.closest(".btn-concluir")) {
      const id = Number(item.dataset.id);
      const peca = pecas.find((p) => p.id === id);
      item.classList.add("saindo");
      setTimeout(() => {
        pecas.splice(pecas.indexOf(peca), 1);
        mostrarLista();
        mostrarAviso(`Peça de ${peca.paciente} marcada como pronta!`);
      }, 300);
    }
  });

  busca.addEventListener("input", mostrarLista);

  mostrarLista();
})();