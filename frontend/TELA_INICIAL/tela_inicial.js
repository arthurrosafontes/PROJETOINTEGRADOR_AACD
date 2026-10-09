// Links do menu do topo: rolam suavemente até a seção correspondente
document.querySelectorAll("[data-ancora]").forEach(link =>
  link.addEventListener("click", e => {
    e.preventDefault();
    document.getElementById(link.dataset.ancora).scrollIntoView({ behavior: "smooth" });
  })
);