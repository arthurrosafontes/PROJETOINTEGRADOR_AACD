// ===== Menu: abrir/fechar os dropdowns =====
const itensDrop = document.querySelectorAll(".has-drop");

function fecharTodos() {
  itensDrop.forEach(item => {
    item.classList.remove("open");
    item.querySelector("button").setAttribute("aria-expanded", "false");
  });
}

function abrir(item) {
  fecharTodos();
  item.classList.add("open");
  item.querySelector("button").setAttribute("aria-expanded", "true");
}

itensDrop.forEach(item => {
  const botao = item.querySelector("button");

  // Clique abre/fecha (funciona no celular também)
  botao.addEventListener("click", e => {
    e.stopPropagation();
    item.classList.contains("open") ? fecharTodos() : abrir(item);
  });

  // No computador, passar o mouse também abre
  if (window.matchMedia("(hover: hover)").matches) {
    item.addEventListener("mouseenter", () => abrir(item));
    item.addEventListener("mouseleave", fecharTodos);
  }
});

// Fecha ao clicar fora do menu ou apertar Esc
document.addEventListener("click", e => {
  if (!e.target.closest(".menu")) fecharTodos();
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape") fecharTodos();
});

// ===== Troca o título do conteúdo conforme o item escolhido =====
const conteudo = document.getElementById("conteudo");

document.querySelectorAll(".dropdown a, .menu > li > a").forEach(link => {
  link.addEventListener("click", e => {
    const destino = link.getAttribute("href");
    // links para outras páginas (ex.: cadastrar-impressora.html) seguem normalmente
    if (!destino.startsWith("#")) return;

    e.preventDefault();
    conteudo.textContent = link.textContent.toUpperCase();
    fecharTodos();
  });
});