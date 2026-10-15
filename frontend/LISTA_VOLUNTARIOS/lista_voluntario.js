// ===== DADOS DE EXEMPLO =====
// Depois você pode trocar isso por um fetch() para a sua API.
const voluntarios = [
  { id: 301, nome: "Rafael Martins", cidade: "São Paulo - SP", status: "Ativo", impressoras: "Ender 3 V2, Bambu Lab P1S", materiais: "PLA, PETG, TPU", entregues: 14, emProducao: 2, email: "rafael.martins@email.com", telefone: "(11) 98765-4321", cadastro: "2026-03-12" },
  { id: 302, nome: "Juliana Costa", cidade: "Campinas - SP", status: "Ativo", impressoras: "Prusa MK4", materiais: "PLA, PETG", entregues: 9, emProducao: 1, email: "juliana.costa@email.com", telefone: "(19) 99876-5432", cadastro: "2026-05-02" },
  { id: 303, nome: "Pedro Almeida", cidade: "Santos - SP", status: "Pendente", impressoras: "Ender 3 S1", materiais: "PLA", entregues: 0, emProducao: 0, email: "pedro.almeida@email.com", telefone: "(13) 99123-4567", cadastro: "2026-10-10" },
  { id: 304, nome: "Fernanda Lopes", cidade: "Guarulhos - SP", status: "Ativo", impressoras: "Bambu Lab A1", materiais: "PLA, TPU", entregues: 21, emProducao: 3, email: "fernanda.lopes@email.com", telefone: "(11) 97654-3210", cadastro: "2026-01-20" },
  { id: 305, nome: "Lucas Ferreira", cidade: "Sorocaba - SP", status: "Inativo", impressoras: "Anycubic Kobra 2", materiais: "PLA", entregues: 4, emProducao: 0, email: "lucas.ferreira@email.com", telefone: "(15) 98888-1122", cadastro: "2026-02-08" },
  { id: 306, nome: "Camila Ribeiro", cidade: "São Paulo - SP", status: "Pendente", impressoras: "Elegoo Saturn 3 (resina)", materiais: "Resina", entregues: 0, emProducao: 0, email: "camila.ribeiro@email.com", telefone: "(11) 96543-2109", cadastro: "2026-10-12" },
];

// Botão de ação de cada status: texto e novo status depois do clique
const acaoPorStatus = {
  Pendente: { texto: "Aprovar", novoStatus: "Ativo", aviso: "aprovado(a)" },
  Ativo: { texto: "Desativar", novoStatus: "Inativo", aviso: "desativado(a)" },
  Inativo: { texto: "Reativar", novoStatus: "Ativo", aviso: "reativado(a)" },
};

// ===== ELEMENTOS =====
const lista = document.getElementById("listaVoluntarios");
const busca = document.getElementById("busca");
const filtroStatus = document.getElementById("filtroStatus");
const ordenar = document.getElementById("ordenar");
const contador = document.getElementById("contador");
const vazio = document.getElementById("vazio");
const toast = document.getElementById("toast");

// ===== FUNÇÕES =====
function formatarData(iso) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

// "Rafael Martins" -> "RM"
function iniciais(nome) {
  const partes = nome.trim().split(" ");
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

function filtrarVoluntarios() {
  const termo = busca.value.trim().toLowerCase();
  const status = filtroStatus.value;

  let resultado = voluntarios.filter(v => {
    const bateTexto = v.nome.toLowerCase().includes(termo) || v.cidade.toLowerCase().includes(termo);
    const bateStatus = status === "todos" || v.status === status;
    return bateTexto && bateStatus;
  });

  if (ordenar.value === "nome") resultado.sort((a, b) => a.nome.localeCompare(b.nome));
  if (ordenar.value === "entregas") resultado.sort((a, b) => b.entregues - a.entregues);
  if (ordenar.value === "recentes") resultado.sort((a, b) => b.cadastro.localeCompare(a.cadastro));

  return resultado;
}

function renderizar() {
  const itens = filtrarVoluntarios();
  lista.innerHTML = "";

  itens.forEach(v => {
    const acao = acaoPorStatus[v.status];
    const li = document.createElement("li");
    li.className = `voluntario ${v.status}`;
    li.dataset.id = v.id;
    li.innerHTML = `
      <div class="voluntario-iniciais">${iniciais(v.nome)}</div>
      <div class="voluntario-info">
        <div class="voluntario-titulo">
          <h3>${v.nome}</h3>
          <span class="badge ${v.status}">${v.status}</span>
          <span class="voluntario-codigo">#${v.id}</span>
        </div>
        <div class="voluntario-detalhes">
          <span>Cidade: <strong>${v.cidade}</strong></span>
          <span>Peças entregues: <strong>${v.entregues}</strong></span>
          <span>Em produção: <strong>${v.emProducao}</strong></span>
          <span>Desde: <strong>${formatarData(v.cadastro)}</strong></span>
        </div>
      </div>
      <div class="voluntario-acoes">
        <button class="btn btn-secundario" data-acao="detalhes">Detalhes</button>
        <button class="btn btn-primario" data-acao="status">${acao.texto}</button>
      </div>
    `;
    lista.appendChild(li);
  });

  contador.textContent = `${itens.length} voluntário(s) encontrado(s)`;
  vazio.hidden = itens.length > 0;
}

// Mostra um aviso rápido na parte de baixo da tela. Ex: mostrarToast("Salvo!");
function mostrarToast(mensagem) {
  toast.textContent = mensagem;
  toast.classList.add("visivel");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("visivel"), 2500);
}

// ===== EVENTOS DA LISTA =====
lista.addEventListener("click", e => {
  const botao = e.target.closest("button[data-acao]");
  if (!botao) return;

  const item = botao.closest(".voluntario");
  const id = Number(item.dataset.id);
  const voluntario = voluntarios.find(v => v.id === id);

  if (botao.dataset.acao === "detalhes") {
    const extra = item.querySelector(".voluntario-extra");
    if (extra) {
      extra.remove();
      botao.textContent = "Detalhes";
    } else {
      const div = document.createElement("div");
      div.className = "voluntario-extra";
      div.innerHTML = `
        <dl>
          <dt>E-mail:</dt><dd>${voluntario.email}</dd>
          <dt>Telefone:</dt><dd>${voluntario.telefone}</dd>
          <dt>Impressoras:</dt><dd>${voluntario.impressoras}</dd>
          <dt>Materiais:</dt><dd>${voluntario.materiais}</dd>
        </dl>
      `;
      item.appendChild(div);
      botao.textContent = "Fechar";
    }
  }

  if (botao.dataset.acao === "status") {
    const acao = acaoPorStatus[voluntario.status];
    voluntario.status = acao.novoStatus;
    renderizar();
    mostrarToast(`${voluntario.nome} foi ${acao.aviso}.`);
  }
});

// ===== FILTROS =====
busca.addEventListener("input", renderizar);
filtroStatus.addEventListener("change", renderizar);
ordenar.addEventListener("change", renderizar);

// ===== DROPDOWNS DA NAVBAR =====
document.querySelectorAll(".dropdown > button").forEach(botao => {
  botao.addEventListener("click", e => {
    e.stopPropagation();
    const dropdown = botao.parentElement;
    const estavaAberto = dropdown.classList.contains("aberto");
    document.querySelectorAll(".dropdown.aberto").forEach(d => d.classList.remove("aberto"));
    if (!estavaAberto) dropdown.classList.add("aberto");
  });
});

document.addEventListener("click", () => {
  document.querySelectorAll(".dropdown.aberto").forEach(d => d.classList.remove("aberto"));
});

// Menu mobile
document.getElementById("menuToggle").addEventListener("click", e => {
  e.stopPropagation();
  document.getElementById("menu").classList.toggle("aberto");
});

// ===== INICIAR =====
renderizar();