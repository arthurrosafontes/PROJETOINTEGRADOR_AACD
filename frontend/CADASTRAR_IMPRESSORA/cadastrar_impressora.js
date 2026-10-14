// ===== CONFIGURAÇÃO DAS ETAPAS =====
// Cada etapa lista os campos obrigatórios que precisam ser validados antes de avançar.
const etapasConfig = [
  { nome: "Identificação", campos: ["nome", "marca", "modelo", "tecnologia"] },
  { nome: "Endereço", campos: ["cep", "rua", "numero", "bairro", "cidade", "estado"] },
  { nome: "Especificações", campos: ["volumeX", "volumeY", "volumeZ", "bico"] },
  { nome: "Filamento", campos: ["diametroFilamento"] },
  { nome: "Revisão", campos: [] },
];

let etapaAtual = 0;
let etapaMaxima = 0; // etapa mais avançada que o usuário já alcançou

// ===== ELEMENTOS =====
const form = document.getElementById("formImpressora");
const passos = document.querySelectorAll(".passo");
const botoesEtapa = document.querySelectorAll(".etapa");
const btnProximo = document.getElementById("btnProximo");
const btnVoltar = document.getElementById("btnVoltar");
const revisao = document.getElementById("revisao");
const erroMateriais = document.getElementById("erroMateriais");
const toast = document.getElementById("toast");

// ===== FUNÇÕES =====
function valor(id) {
  return document.getElementById(id).value.trim();
}

function materiaisSelecionados() {
  return [...form.querySelectorAll('input[name="materiais"]:checked')].map(c => c.value);
}

function marcarErro(campo, temErro) {
  // O erro fica no .campo (ou na div interna do .campo-duplo)
  const container = campo.closest(".campo-duplo > div") || campo.closest(".campo");
  container.classList.toggle("invalido", temErro);
}

function campoValido(id) {
  const campo = document.getElementById(id);
  let ok = campo.value.trim() !== "";

  if (id === "cep") ok = /^\d{5}-?\d{3}$/.test(campo.value.trim());
  if (id === "estado") ok = /^[A-Za-z]{2}$/.test(campo.value.trim());
  if (campo.type === "number" && ok) ok = Number(campo.value) > 0;

  marcarErro(campo, !ok);
  return ok;
}

function validarEtapa(indice) {
  let valido = true;
  let primeiroInvalido = null;

  etapasConfig[indice].campos.forEach(id => {
    if (!campoValido(id)) {
      valido = false;
      if (!primeiroInvalido) primeiroInvalido = document.getElementById(id);
    }
  });

  // Na etapa de filamento, pelo menos um material precisa estar marcado
  if (indice === 3) {
    const temMaterial = materiaisSelecionados().length > 0;
    erroMateriais.classList.toggle("visivel", !temMaterial);
    if (!temMaterial) valido = false;
  }

  if (primeiroInvalido) primeiroInvalido.focus();
  return valido;
}

function irParaEtapa(indice) {
  etapaAtual = indice;
  etapaMaxima = Math.max(etapaMaxima, indice);

  passos.forEach((p, i) => p.classList.toggle("ativo", i === indice));

  botoesEtapa.forEach((b, i) => {
    b.classList.toggle("ativa", i === indice);
    b.classList.toggle("concluida", i < etapaMaxima && i !== indice);
    b.disabled = i > etapaMaxima;
  });

  btnVoltar.hidden = indice === 0;
  btnProximo.textContent = indice === etapasConfig.length - 1 ? "Cadastrar ✓" : "Próximo →";

  if (indice === etapasConfig.length - 1) montarRevisao();

  const primeiroCampo = passos[indice].querySelector("input, select");
  if (primeiroCampo) primeiroCampo.focus();
}

function linha(rotulo, texto) {
  return `<dt>${rotulo}</dt><dd>${texto || "—"}</dd>`;
}

function montarRevisao() {
  const endereco = `${valor("rua")}, ${valor("numero")}${valor("complemento") ? " - " + valor("complemento") : ""}`;
  const bico = valor("bico") ? `${valor("bico")} mm` : "";

  revisao.innerHTML = `
    <div class="revisao-bloco">
      <h3>Identificação <button type="button" data-ir="0">Editar</button></h3>
      <dl>
        ${linha("Nome", valor("nome"))}
        ${linha("Marca", valor("marca"))}
        ${linha("Modelo", valor("modelo"))}
        ${linha("Tecnologia", valor("tecnologia"))}
      </dl>
    </div>
    <div class="revisao-bloco">
      <h3>Endereço <button type="button" data-ir="1">Editar</button></h3>
      <dl>
        ${linha("CEP", valor("cep"))}
        ${linha("Endereço", endereco)}
        ${linha("Bairro", valor("bairro"))}
        ${linha("Cidade", `${valor("cidade")} / ${valor("estado").toUpperCase()}`)}
      </dl>
    </div>
    <div class="revisao-bloco">
      <h3>Especificações <button type="button" data-ir="2">Editar</button></h3>
      <dl>
        ${linha("Área (X×Y×Z)", `${valor("volumeX")} × ${valor("volumeY")} × ${valor("volumeZ")} mm`)}
        ${linha("Bico", bico)}
        ${linha("Temp. máx.", valor("tempBico") && `${valor("tempBico")} °C`)}
        ${linha("Velocidade", valor("velocidade") && `${valor("velocidade")} mm/s`)}
        ${linha("Mesa aquecida", document.getElementById("mesaAquecida").checked ? "Sim" : "Não")}
        ${linha("Enclausurada", document.getElementById("enclausurada").checked ? "Sim" : "Não")}
      </dl>
    </div>
    <div class="revisao-bloco">
      <h3>Filamento <button type="button" data-ir="3">Editar</button></h3>
      <dl>
        ${linha("Materiais", materiaisSelecionados().join(", "))}
        ${linha("Diâmetro", valor("diametroFilamento") && valor("diametroFilamento") !== "Não se aplica" ? `${valor("diametroFilamento")} mm` : valor("diametroFilamento"))}
        ${linha("Cores", valor("cores"))}
      </dl>
    </div>
  `;
}

function montarImpressora() {
  return {
    id: Date.now(),
    nome: valor("nome"),
    marca: valor("marca"),
    modelo: valor("modelo"),
    tecnologia: valor("tecnologia"),
    endereco: {
      cep: valor("cep"),
      rua: valor("rua"),
      numero: valor("numero"),
      complemento: valor("complemento"),
      bairro: valor("bairro"),
      cidade: valor("cidade"),
      estado: valor("estado").toUpperCase(),
    },
    especificacoes: {
      volume: { x: Number(valor("volumeX")), y: Number(valor("volumeY")), z: Number(valor("volumeZ")) },
      bico: Number(valor("bico")),
      tempBico: Number(valor("tempBico")) || null,
      velocidade: Number(valor("velocidade")) || null,
      mesaAquecida: document.getElementById("mesaAquecida").checked,
      enclausurada: document.getElementById("enclausurada").checked,
    },
    filamento: {
      materiais: materiaisSelecionados(),
      diametro: valor("diametroFilamento"),
      cores: valor("cores"),
    },
  };
}

function cadastrar() {
  const impressora = montarImpressora();

  // Depois você pode trocar isso por um fetch() para a sua API, por exemplo:
  // fetch("/api/impressoras", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(impressora) })
  try {
    const salvas = JSON.parse(localStorage.getItem("impressoras") || "[]");
    salvas.push(impressora);
    localStorage.setItem("impressoras", JSON.stringify(salvas));
  } catch (e) {
    console.warn("Não foi possível salvar no navegador.", e);
  }

  mostrarToast(`Impressora "${impressora.nome}" cadastrada com sucesso!`);
  form.reset();
  document.querySelectorAll(".invalido").forEach(c => c.classList.remove("invalido"));
  etapaMaxima = 0;
  irParaEtapa(0);
}

function mostrarToast(mensagem) {
  toast.textContent = mensagem;
  toast.classList.add("visivel");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("visivel"), 2500);
}

// ===== BUSCA DE CEP (ViaCEP) =====
async function buscarCep() {
  const cep = valor("cep").replace(/\D/g, "");
  if (cep.length !== 8) return;

  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const dados = await resposta.json();
    if (dados.erro) {
      mostrarToast("CEP não encontrado.");
      return;
    }
    const preencher = { rua: dados.logradouro, bairro: dados.bairro, cidade: dados.localidade, estado: dados.uf };
    Object.entries(preencher).forEach(([id, texto]) => {
      if (texto) {
        document.getElementById(id).value = texto;
        marcarErro(document.getElementById(id), false);
      }
    });
    document.getElementById("numero").focus();
  } catch (e) {
    // Sem internet ou API fora do ar: o usuário preenche manualmente
  }
}

// ===== EVENTOS DO FORMULÁRIO =====
btnProximo.addEventListener("click", () => {
  if (etapaAtual === etapasConfig.length - 1) {
    cadastrar();
    return;
  }
  if (validarEtapa(etapaAtual)) irParaEtapa(etapaAtual + 1);
});

btnVoltar.addEventListener("click", () => {
  if (etapaAtual > 0) irParaEtapa(etapaAtual - 1);
});

// Clicar no nome da etapa (só nas que já foram alcançadas)
botoesEtapa.forEach(botao => {
  botao.addEventListener("click", () => {
    const destino = Number(botao.dataset.etapa);
    if (destino > etapaMaxima) return;
    // Para avançar pelo menu, a etapa atual precisa estar válida
    if (destino > etapaAtual && !validarEtapa(etapaAtual)) return;
    irParaEtapa(destino);
  });
});

// Botões "Editar" da revisão
revisao.addEventListener("click", e => {
  const botao = e.target.closest("button[data-ir]");
  if (botao) irParaEtapa(Number(botao.dataset.ir));
});

// Enter avança para a próxima etapa
form.addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "checkbox") {
    e.preventDefault();
    btnProximo.click();
  }
});

// Remove o aviso de erro assim que o usuário corrige o campo
form.addEventListener("input", e => {
  const campo = e.target;
  if (campo.name === "materiais") {
    if (materiaisSelecionados().length) erroMateriais.classList.remove("visivel");
    return;
  }
  const container = campo.closest(".campo-duplo > div") || campo.closest(".campo");
  if (container && container.classList.contains("invalido")) campoValido(campo.id);
});

// Máscara do CEP (00000-000) e busca automática
document.getElementById("cep").addEventListener("input", e => {
  let numeros = e.target.value.replace(/\D/g, "").slice(0, 8);
  if (numeros.length > 5) numeros = numeros.slice(0, 5) + "-" + numeros.slice(5);
  e.target.value = numeros;
  if (numeros.length === 9) buscarCep();
});

// UF sempre em maiúsculo
document.getElementById("estado").addEventListener("input", e => {
  e.target.value = e.target.value.replace(/[^A-Za-z]/g, "").toUpperCase();
});

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
irParaEtapa(0);