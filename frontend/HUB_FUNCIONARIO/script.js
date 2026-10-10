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