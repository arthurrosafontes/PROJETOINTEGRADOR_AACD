// Lista de pacientes (exemplo — substitua pelos dados reais)
// prazo no formato AAAA-MM-DD
const pacientes = [
  { nome: "Maria Souza",      protese: "Prótese de mão",        prazo: "2026-10-30" },
  { nome: "João Pereira",     protese: "Prótese de antebraço",  prazo: "2026-10-12" },
  { nome: "Ana Lima",         protese: "Prótese de dedo",       prazo: "2026-10-05" },
  { nome: "Carlos Mendes",    protese: "Órtese de punho",       prazo: "2026-11-15" },
  { nome: "Beatriz Rocha",    protese: "Prótese de mão",        prazo: "2026-10-08" },
  { nome: "Lucas Oliveira",   protese: "Prótese de braço",      prazo: "2026-11-02" }
];

const lista = document.getElementById("lista");
const busca = document.getElementById("busca");
let selecionado = 0;

function paraData(texto) {
  const [ano, mes, dia] = texto.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

function diasRestantes(texto) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((paraData(texto) - hoje) / 86400000);
}

// Retorna o texto e a cor da etiqueta de prazo
function situacao(texto) {
  const dias = diasRestantes(texto);
  if (dias < 0) return { texto: `Atrasado ${-dias} dia${dias === -1 ? "" : "s"}`, classe: "atrasado" };
  if (dias === 0) return { texto: "Entrega hoje", classe: "alerta" };
  return { texto: `Faltam ${dias} dia${dias === 1 ? "" : "s"}`, classe: dias <= 5 ? "alerta" : "" };
}

function iniciais(nome) {
  return nome.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase();
}

function renderLista() {
  const termo = busca.value.trim().toLowerCase();

  // Ordena pelo prazo mais próximo e filtra pela busca
  const filtrados = pacientes
    .map((p, i) => ({ ...p, indice: i }))
    .sort((a, b) => paraData(a.prazo) - paraData(b.prazo))
    .filter(p => (p.nome + " " + p.protese).toLowerCase().includes(termo));

  lista.innerHTML = "";
  filtrados.forEach(p => {
    const s = situacao(p.prazo);
    const li = document.createElement("li");
    li.className = "lista-item" + (p.indice === selecionado ? " selecionado" : "");
    li.innerHTML = `
      <div class="col-paciente">
        <span class="iniciais">${iniciais(p.nome)}</span>
        <strong>${p.nome}</strong>
      </div>
      <div class="col-protese" data-titulo="Prótese">${p.protese}</div>
      <div class="col-prazo" data-titulo="Prazo">${paraData(p.prazo).toLocaleDateString("pt-BR")}</div>
      <div class="col-situacao"><span class="prazo-tag ${s.classe}">${s.texto}</span></div>
    `;
    li.addEventListener("click", () => {
      selecionado = p.indice;
      renderLista();
    });
    lista.appendChild(li);
  });

  document.getElementById("vazia").hidden = filtrados.length > 0;
  document.getElementById("contagem").textContent =
    `${filtrados.length} paciente${filtrados.length === 1 ? "" : "s"} · ordenados pelo prazo mais próximo`;
}

busca.addEventListener("input", renderLista);

renderLista();

// Menus suspensos
document.querySelectorAll(".nav-item").forEach(item => {
  const btn = item.querySelector(".nav-btn");
  if (!item.querySelector(".dropdown")) return;
  btn.addEventListener("click", e => {
    e.stopPropagation();
    document.querySelectorAll(".nav-item.open").forEach(o => o !== item && o.classList.remove("open"));
    item.classList.toggle("open");
  });
});
document.addEventListener("click", () =>
  document.querySelectorAll(".nav-item.open").forEach(o => o.classList.remove("open")));