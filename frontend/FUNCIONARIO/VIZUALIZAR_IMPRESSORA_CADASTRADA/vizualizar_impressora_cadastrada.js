// =====================================================
// TELA: Impressoras cadastradas (frontend)
// Este arquivo só cuida da tela. Os dados vêm da API
// (backend/server.js), que lê e grava no banco de dados.
// =====================================================

// Endereço da API. Troque se o backend rodar em outra porta/servidor.
const API_URL = "http://localhost:3000/api";

// Lista que vem da API. Formato de cada impressora:
// { id, modelo, tecnologia, largura, profundidade, altura, bico, materiais, obs, cadastro,
//   voluntarioId, voluntarioNome, voluntarioCidade, voluntarioStatus, voluntarioEmail, voluntarioTelefone }
let impressoras = [];

// ===== ELEMENTOS =====
const lista = document.getElementById("listaImpressoras");
const busca = document.getElementById("busca");
const filtroTecnologia = document.getElementById("filtroTecnologia");
const ordenar = document.getElementById("ordenar");
const contador = document.getElementById("contador");
const vazio = document.getElementById("vazio");
const toast = document.getElementById("toast");

// ===== CHAMADAS À API =====
async function buscarImpressoras() {
  const resposta = await fetch(`${API_URL}/impressoras`);
  if (!resposta.ok) throw new Error("Não foi possível carregar as impressoras.");
  return resposta.json();
}

async function removerImpressora(id) {
  const resposta = await fetch(`${API_URL}/impressoras/${id}`, { method: "DELETE" });
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados.erro || "Não foi possível remover a impressora.");
  return dados;
}

// ===== FUNÇÕES =====
function formatarData(iso) {
  if (!iso) return "-";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

// Evita que textos do banco virem HTML na tela
function escapar(texto) {
  const div = document.createElement("div");
  div.textContent = texto ?? "";
  return div.innerHTML;
}

// 220, 220, 250 -> "220 × 220 × 250 mm"
function areaImpressao(i) {
  if (!i.largura || !i.profundidade || !i.altura) return "-";
  return `${i.largura} × ${i.profundidade} × ${i.altura} mm`;
}

function filtrarImpressoras() {
  const termo = busca.value.trim().toLowerCase();
  const tecnologia = filtroTecnologia.value;

  let resultado = impressoras.filter(i => {
    const texto = `${i.modelo} ${i.voluntarioNome} ${i.voluntarioCidade || ""}`.toLowerCase();
    const bateTexto = texto.includes(termo);
    const bateTecnologia = tecnologia === "todas" || i.tecnologia === tecnologia;
    return bateTexto && bateTecnologia;
  });

  if (ordenar.value === "recentes") resultado.sort((a, b) => b.cadastro.localeCompare(a.cadastro));
  if (ordenar.value === "modelo") resultado.sort((a, b) => a.modelo.localeCompare(b.modelo));
  if (ordenar.value === "voluntario") resultado.sort((a, b) => a.voluntarioNome.localeCompare(b.voluntarioNome));

  return resultado;
}

function renderizar() {
  const itens = filtrarImpressoras();
  lista.innerHTML = "";

  itens.forEach(i => {
    const li = document.createElement("li");
    li.className = "impressora";
    li.dataset.id = i.id;
    li.innerHTML = `
      <div class="impressora-info">
        <div class="impressora-titulo">
          <h3>${escapar(i.modelo)}</h3>
          <span class="badge ${escapar(i.tecnologia)}">${escapar(i.tecnologia)}</span>
          <span class="impressora-codigo">#${i.id}</span>
        </div>
        <div class="impressora-detalhes">
          <span>Voluntário: <strong>${escapar(i.voluntarioNome)}</strong></span>
          <span>Cidade: <strong>${escapar(i.voluntarioCidade) || "-"}</strong></span>
          <span>Área: <strong>${areaImpressao(i)}</strong></span>
          <span>Materiais: <strong>${escapar(i.materiais) || "-"}</strong></span>
        </div>
      </div>
      <div class="impressora-acoes">
        <button class="btn btn-secundario" data-acao="detalhes">Detalhes</button>
        <button class="btn btn-perigo" data-acao="remover">Remover</button>
      </div>
    `;
    lista.appendChild(li);
  });

  contador.textContent = `${itens.length} impressora(s) encontrada(s)`;
  vazio.textContent = "Nenhuma impressora encontrada.";
  vazio.hidden = itens.length > 0;
}

// Mostra um aviso rápido na parte de baixo da tela. Ex: mostrarToast("Salvo!");
function mostrarToast(mensagem, erro = false) {
  toast.textContent = mensagem;
  toast.classList.toggle("erro", erro);
  toast.classList.add("visivel");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("visivel"), 2500);
}

// ===== EVENTOS DA LISTA =====
lista.addEventListener("click", async e => {
  const botao = e.target.closest("button[data-acao]");
  if (!botao) return;

  const item = botao.closest(".impressora");
  const id = Number(item.dataset.id);
  const impressora = impressoras.find(i => i.id === id);

  if (botao.dataset.acao === "detalhes") {
    const extra = item.querySelector(".impressora-extra");
    if (extra) {
      extra.remove();
      botao.textContent = "Detalhes";
    } else {
      const div = document.createElement("div");
      div.className = "impressora-extra";
      div.innerHTML = `
        <dl>
          <dt>Tecnologia:</dt><dd>${escapar(impressora.tecnologia)}</dd>
          <dt>Área de impressão:</dt><dd>${areaImpressao(impressora)}</dd>
          <dt>Bico:</dt><dd>${impressora.bico ? escapar(impressora.bico) + " mm" : "-"}</dd>
          <dt>Materiais:</dt><dd>${escapar(impressora.materiais) || "-"}</dd>
          <dt>Cadastrada em:</dt><dd>${formatarData(impressora.cadastro)}</dd>
          <dt>Voluntário:</dt><dd>${escapar(impressora.voluntarioNome)} (#${impressora.voluntarioId}, ${escapar(impressora.voluntarioStatus)})</dd>
          <dt>E-mail:</dt><dd>${escapar(impressora.voluntarioEmail) || "-"}</dd>
          <dt>Telefone:</dt><dd>${escapar(impressora.voluntarioTelefone) || "-"}</dd>
          <dt>Observações:</dt><dd>${escapar(impressora.obs) || "-"}</dd>
        </dl>
      `;
      item.appendChild(div);
      botao.textContent = "Fechar";
    }
  }

  if (botao.dataset.acao === "remover") {
    const ok = confirm(`Remover a impressora "${impressora.modelo}" de ${impressora.voluntarioNome}?\nEssa ação não pode ser desfeita.`);
    if (!ok) return;

    botao.disabled = true;
    botao.textContent = "Removendo...";
    try {
      await removerImpressora(id);
      item.classList.add("saindo");
      setTimeout(() => {
        impressoras = impressoras.filter(i => i.id !== id);
        renderizar();
        mostrarToast(`Impressora "${impressora.modelo}" removida.`);
      }, 300);
    } catch (erro) {
      botao.disabled = false;
      botao.textContent = "Remover";
      mostrarToast(erro.message, true);
    }
  }
});

// ===== FILTROS =====
busca.addEventListener("input", renderizar);
filtroTecnologia.addEventListener("change", renderizar);
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
async function iniciar() {
  try {
    impressoras = await buscarImpressoras();
    renderizar();
  } catch (erro) {
    contador.textContent = "";
    vazio.textContent = "Erro ao carregar as impressoras. Verifique se o backend está rodando.";
    vazio.hidden = false;
  }
}

iniciar();