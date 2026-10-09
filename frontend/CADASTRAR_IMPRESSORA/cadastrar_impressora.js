// Menu do Voluntário — edite aqui para mudar itens/links
const menuVoluntario = [
  { label:"Pedidos", sub:["Pedidos disponíveis","Pedidos recomendados","Pedidos aceitos","Pedidos recusados"] },
  { label:"Impressora", sub:["Cadastrar Impressora","Selecionar Impressora","Ficha Técnica Impressora","Tipo de filamento"] },
  { label:"Produção", sub:["Em produção","Aguardando envio","Aguardando validação","Concluídas"] },
  { label:"Sobre" }
];

// Páginas que já existem (o resto fica como âncora até ser criado)
const paginas = {
  "Pedidos disponíveis": "pedidos_disponiveis.html",
  "Cadastrar Impressora": "cadastrar_impressora.html"
};
const PAGINA_ATUAL = "Cadastrar Impressora";

const menuEl = document.getElementById("menu");
const form = document.getElementById("formImpressora");
const mensagem = document.getElementById("mensagem");

const slug = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-");
const link = s => paginas[s] || `#${slug(s)}`;

function renderMenu() {
  menuEl.innerHTML = menuVoluntario.map(it => it.sub
    ? `<li class="has-drop${it.sub.includes(PAGINA_ATUAL) ? " atual" : ""}">
         <button type="button" aria-haspopup="true" aria-expanded="false">${it.label}<span class="caret"></span></button>
         <ul class="dropdown">${it.sub.map(s => `<li><a href="${link(s)}"${s === PAGINA_ATUAL ? ' class="ativo"' : ""}>${s}</a></li>`).join("")}</ul>
       </li>`
    : `<li><a href="${link(it.label)}">${it.label}</a></li>`
  ).join("");
}

function fecharTodos() {
  document.querySelectorAll(".has-drop.open").forEach(x => { x.classList.remove("open"); x.firstElementChild.setAttribute("aria-expanded","false"); });
}

// Abrir/fechar dropdown por clique (celular)
menuEl.addEventListener("click", e => {
  const btn = e.target.closest(".has-drop > button");
  if (!btn) { fecharTodos(); return; }
  const li = btn.parentElement, aberto = li.classList.contains("open");
  fecharTodos();
  if (!aberto) { li.classList.add("open"); btn.setAttribute("aria-expanded","true"); }
});

// Fechar ao clicar fora ou apertar Esc
document.addEventListener("click", e => { if (!e.target.closest(".menu")) fecharTodos(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") fecharTodos(); });

// Cadastro da impressora
function mostrarMensagem(texto, erro) {
  mensagem.textContent = texto;
  mensagem.classList.toggle("erro", !!erro);
}

form.addEventListener("input", e => e.target.classList.remove("erro"));

form.addEventListener("submit", e => {
  e.preventDefault();
  const campos = [...form.querySelectorAll(".campo")];
  const vazios = campos.filter(c => !c.value.trim());
  campos.forEach(c => c.classList.toggle("erro", vazios.includes(c)));

  if (vazios.length) {
    mostrarMensagem("Preencha todos os campos.", true);
    vazios[0].focus();
    return;
  }

  const impressora = Object.fromEntries(new FormData(form));
  // Por enquanto salva só no navegador; depois trocar por envio ao servidor
  try {
    const lista = JSON.parse(localStorage.getItem("impressoras") || "[]");
    lista.push(impressora);
    localStorage.setItem("impressoras", JSON.stringify(lista));
  } catch (err) { /* navegador sem localStorage: segue sem salvar */ }

  mostrarMensagem(`Impressora "${impressora.nome}" cadastrada!`);
  form.reset();
});

renderMenu();