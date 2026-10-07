// Menus por perfil — edite aqui para mudar itens/links
const menus = {
  funcionario: {
    role: "Funcionário",
    items: [
      { label:"Demandas", sub:["Tipo de órtese","Medida","Tipo de Reparo"] },
      { label:"Voluntários", sub:["Lista de Voluntários","Ocorrências Cadastradas","Disponibilidade","Homologação"] },
      { label:"Próteses", sub:["Tipos de Prótese","Modelos / Arquivos 3D","Especificações Técnicas","Histórico de Fabricação"] },
      { label:"Sobre" }
    ]
  },
  voluntario: {
    role: "Voluntário",
    items: [
      { label:"Pedidos", sub:["Pedidos disponíveis","Pedidos recomendados","Pedidos criados","Pedidos recusados"] },
      { label:"Impressoras", sub:["Cadastrar Impressora","Selecionar Impressora","Ficha Técnica (impressora)","Tipo de Material"] },
      { label:"Produção", sub:["Em produção","Aguardando envio","Aguardando validação","Concluídos"] },
      { label:"Sobre" }
    ]
  }
};

const menuEl = document.getElementById("menu");
let perfil = "funcionario";

const slug = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-");

function render() {
  const m = menus[perfil];
  document.getElementById("userRole").textContent = m.role;
  document.getElementById("switch").textContent = "Ver como: " + (perfil === "funcionario" ? "Voluntário" : "Funcionário");
  menuEl.innerHTML = m.items.map(it => it.sub
    ? `<li class="has-drop">
         <button type="button" aria-haspopup="true" aria-expanded="false">${it.label}<span class="caret"></span></button>
         <ul class="dropdown">${it.sub.map(s => `<li><a href="#${slug(s)}">${s}</a></li>`).join("")}</ul>
       </li>`
    : `<li><a href="#${slug(it.label)}">${it.label}</a></li>`
  ).join("");
}

// Abrir/fechar por clique (celular) e fechar ao clicar fora
menuEl.addEventListener("click", e => {
  const btn = e.target.closest(".has-drop > button");
  if (!btn) return;
  const li = btn.parentElement, aberto = li.classList.contains("open");
  document.querySelectorAll(".has-drop.open").forEach(x => { x.classList.remove("open"); x.firstElementChild.setAttribute("aria-expanded","false"); });
  if (!aberto) { li.classList.add("open"); btn.setAttribute("aria-expanded","true"); }
});
document.addEventListener("click", e => {
  if (!e.target.closest(".menu")) document.querySelectorAll(".has-drop.open").forEach(x => x.classList.remove("open"));
});

document.getElementById("switch").onclick = () => { perfil = perfil === "funcionario" ? "voluntario" : "funcionario"; render(); };
render();