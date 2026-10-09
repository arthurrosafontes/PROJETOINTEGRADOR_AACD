const form = document.getElementById("form-impressora");
const etapas = [...document.querySelectorAll(".etapa")];
const passos = [...document.querySelectorAll(".passo")];
const btnVoltar = document.getElementById("btn-voltar");
const btnProximo = document.getElementById("btn-proximo");
const btnCadastrar = document.getElementById("btn-cadastrar");
const mensagem = document.getElementById("mensagem");
const resumo = document.getElementById("resumo");

let etapaAtual = 0;
let maiorEtapaVisitada = 0;

/* ---------- Rótulos usados na revisão ---------- */
const rotulos = {
  nome: "Nome",
  modelo: "Modelo",
  marca: "Marca",
  localizacao: "Localização",
  areaMaxima: "Área máxima",
  diametroBico: "Diâmetro do bico",
  tipoFilamento: "Tipo de filamento",
  diametroFilamento: "Diâmetro do filamento",
};

/* ---------- Validação ---------- */
const numeroPositivo = (v) => {
  const n = parseFloat(v.replace(",", "."));
  return !isNaN(n) && n > 0;
};

const regras = {
  nome: (v) => (v.trim() ? "" : "Informe o nome da impressora."),
  modelo: (v) => (v.trim() ? "" : "Informe o modelo."),
  marca: (v) => (v.trim() ? "" : "Informe a marca."),
  localizacao: (v) => (v.trim() ? "" : "Informe onde a impressora fica."),
  areaMaxima: (v) => (v.trim() ? "" : "Informe a área máxima de impressão."),
  diametroBico: (v) => (numeroPositivo(v) ? "" : "Informe um número (ex: 0.4)."),
  tipoFilamento: (v) => (v.trim() ? "" : "Informe o tipo de filamento."),
  diametroFilamento: (v) => (numeroPositivo(v) ? "" : "Informe um número (ex: 1.75)."),
};

function validarCampo(input) {
  const regra = regras[input.name];
  if (!regra) return true;
  const erro = regra(input.value);
  const span = document.querySelector(`[data-erro-de="${input.name}"]`);
  if (span) span.textContent = erro;
  input.classList.toggle("invalido", Boolean(erro));
  return !erro;
}

function validarEtapa(indice) {
  const inputs = [...etapas[indice].querySelectorAll(".campo")];
  const resultados = inputs.map(validarCampo);
  const primeiroInvalido = inputs.find((_, i) => !resultados[i]);
  if (primeiroInvalido) primeiroInvalido.focus();
  return resultados.every(Boolean);
}

form.querySelectorAll(".campo").forEach((input) => {
  input.addEventListener("blur", () => validarCampo(input));
  input.addEventListener("input", () => {
    if (input.classList.contains("invalido")) validarCampo(input);
  });
});

/* ---------- Navegação entre etapas ---------- */
function mostrarEtapa(indice) {
  etapaAtual = indice;
  maiorEtapaVisitada = Math.max(maiorEtapaVisitada, indice);
  mensagem.textContent = "";

  etapas.forEach((etapa, i) => (etapa.hidden = i !== indice));

  passos.forEach((passo, i) => {
    passo.classList.toggle("atual", i === indice);
    passo.classList.toggle("visitado", i <= maiorEtapaVisitada && i !== indice);
    if (i === indice) passo.setAttribute("aria-current", "step");
    else passo.removeAttribute("aria-current");
  });

  const ultima = indice === etapas.length - 1;
  btnVoltar.disabled = indice === 0;
  btnProximo.hidden = ultima;
  btnCadastrar.hidden = !ultima;

  if (ultima) montarResumo();

  const primeiroCampo = etapas[indice].querySelector(".campo");
  if (primeiroCampo) primeiroCampo.focus();
}

btnProximo.addEventListener("click", () => {
  if (validarEtapa(etapaAtual)) mostrarEtapa(etapaAtual + 1);
});

btnVoltar.addEventListener("click", () => {
  if (etapaAtual > 0) mostrarEtapa(etapaAtual - 1);
});

// Clicar no breadcrumb: volta livremente; avança só até onde já visitou
passos.forEach((passo, i) => {
  passo.addEventListener("click", () => {
    if (i === etapaAtual || i > maiorEtapaVisitada) return;
    if (i > etapaAtual && !validarEtapa(etapaAtual)) return;
    mostrarEtapa(i);
  });
});

// Enter num campo = Próximo (em vez de enviar o formulário)
form.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.classList.contains("campo")) {
    e.preventDefault();
    btnProximo.click();
  }
});

/* ---------- Revisão ---------- */
function montarResumo() {
  resumo.innerHTML = "";
  Object.entries(rotulos).forEach(([campo, rotulo]) => {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = rotulo;
    dd.textContent = form.elements[campo].value.trim();
    resumo.append(dt, dd);
  });
}

/* ---------- Envio ---------- */
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Garante que todas as etapas estão válidas antes de enviar
  for (let i = 0; i < etapas.length - 1; i++) {
    if (!validarEtapa(i)) {
      mostrarEtapa(i);
      mensagem.textContent = "Corrija os campos destacados.";
      return;
    }
  }

  const dados = Object.fromEntries(
    Object.keys(rotulos).map((campo) => [campo, form.elements[campo].value.trim()])
  );

  // TODO: trocar pela URL da sua API
  // try {
  //   const resp = await fetch("/api/impressoras", {
  //     method: "POST",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify(dados),
  //   });
  //   if (!resp.ok) throw new Error();
  // } catch {
  //   mensagem.textContent = "Erro ao cadastrar. Tente novamente.";
  //   return;
  // }

  console.log("Impressora cadastrada:", dados);
  mensagem.textContent = `Impressora "${dados.nome}" cadastrada com sucesso!`;
  form.reset();
  maiorEtapaVisitada = 0;
  setTimeout(() => mostrarEtapa(0), 1800);
});

mostrarEtapa(0);

/* ---------- Dropdowns do menu ---------- */
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

  botao.addEventListener("click", (e) => {
    e.stopPropagation();
    const abrir = !item.classList.contains("aberto");
    fecharMenus(item);
    item.classList.toggle("aberto", abrir);
    botao.setAttribute("aria-expanded", String(abrir));
  });

  // Seta para baixo no botão abre o menu e foca o primeiro link
  botao.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      fecharMenus(item);
      item.classList.add("aberto");
      botao.setAttribute("aria-expanded", "true");
      item.querySelector(".submenu a").focus();
    }
  });

  // Setas para cima/baixo navegam entre os links do submenu
  item.querySelector(".submenu").addEventListener("keydown", (e) => {
    const links = [...item.querySelectorAll(".submenu a")];
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

  // Fecha quando o foco sai do item (navegação por Tab)
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