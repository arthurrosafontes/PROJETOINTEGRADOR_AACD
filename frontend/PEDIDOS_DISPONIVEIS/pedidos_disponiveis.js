// Menu do Voluntário — edite aqui para mudar itens/links
const menuVoluntario = [
  { label:"Pedidos", sub:["Pedidos disponíveis","Pedidos recomendados","Pedidos aceitos","Pedidos recusados"] },
  { label:"Impressora", sub:["Cadastrar Impressora","Selecionar Impressora","Ficha Técnica Impressora","Tipo de filamento"] },
  { label:"Produção", sub:["Em produção","Aguardando envio","Aguardando validação","Concluídas"] },
  { label:"Sobre" }
];

// Pedidos disponíveis — por enquanto com texto de exemplo (igual ao protótipo)
const exemplo = "=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-";
const pedidos = [
  { id:1, descricao:exemplo },
  { id:2, descricao:exemplo },
  { id:3, descricao:exemplo }
];

const menuEl = document.getElementById("menu");
const listaEl = document.getElementById("listaPedidos");

const slug = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-");

function renderMenu() {
  menuEl.innerHTML = menuVoluntario.map(it => it.sub
    ? `<li class="has-drop">
         <button type="button" aria-haspopup="true" aria-expanded="false">${it.label}<span class="caret"></span></button>
         <ul class="dropdown">${it.sub.map(s => `<li><a href="#${slug(s)}"${s === "Pedidos disponíveis" ? ' class="ativo"' : ""}>${s}</a></li>`).join("")}</ul>
       </li>`
    : `<li><a href="#${slug(it.label)}">${it.label}</a></li>`
  ).join("");
}

function renderPedidos() {
  listaEl.innerHTML = pedidos.map(p =>
    `<li class="pedido" tabindex="0" data-id="${p.id}">Pedido ${p.id}- ${p.descricao}</li>`
  ).join("");
}

function fecharTodos() {
  document.querySelectorAll(".has-drop.open").forEach(x => { x.classList.remove("open"); x.firstElementChild.setAttribute("aria-expanded","false"); });
}

// Abrir/fechar dropdown por clique (celular)
menuEl.addEventListener("click", e => {
  const btn = e.target.closest(".has-drop > button");
  if (btn) {
    const li = btn.parentElement, aberto = li.classList.contains("open");
    fecharTodos();
    if (!aberto) { li.classList.add("open"); btn.setAttribute("aria-expanded","true"); }
    return;
  }
  const link = e.target.closest("a");
  if (link) {
    document.querySelectorAll(".menu a.ativo").forEach(a => a.classList.remove("ativo"));
    link.classList.add("ativo");
    fecharTodos();
  }
});

// Selecionar um pedido (clique ou Enter)
function selecionar(item) {
  document.querySelectorAll(".pedido.selecionado").forEach(x => x.classList.remove("selecionado"));
  item.classList.add("selecionado");
}
listaEl.addEventListener("click", e => { const item = e.target.closest(".pedido"); if (item) selecionar(item); });
listaEl.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.matches(".pedido")) selecionar(e.target); });

// Fechar ao clicar fora ou apertar Esc
document.addEventListener("click", e => { if (!e.target.closest(".menu")) fecharTodos(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") fecharTodos(); });

renderMenu();
renderPedidos();