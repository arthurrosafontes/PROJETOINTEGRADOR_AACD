/* =========================================================
   utilitarios.js — funções compartilhadas por todas as telas
   Cria o objeto global AACD, onde cada arquivo pendura a sua parte:
     AACD.util   -> funções de apoio (este arquivo)
     AACD.api    -> comunicação com o backend (api.js)
     AACD.telas  -> comportamento de cada tela (pasta telas/)
   ========================================================= */
"use strict";

window.AACD = window.AACD || {};
AACD.telas = AACD.telas || {};

AACD.util = (() => {
  const $ = (id) => document.getElementById(id);

  // Evita que textos vindos do banco virem HTML na tela
  function escapar(texto) {
    return String(texto ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // "2026-10-22" -> "22/10/2026"
  function formatarData(iso) {
    if (!iso) return "-";
    const [ano, mes, dia] = String(iso).slice(0, 10).split("-");
    return `${dia}/${mes}/${ano}`;
  }

  // Converte data e horário UTC para o horário de Brasília
function formatarDataHora(utc) {
  if (!utc) return "-";

  // Recebe valores como "2026-10-29 15:05:29"
  const texto = String(utc).trim();

  // Informa que a data recebida está em UTC
  const dataUTC = new Date(
    texto.replace(" ", "T").replace(/Z?$/, "Z")
  );

  if (Number.isNaN(dataUTC.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(dataUTC);
}

  // Data de hoje no formato AAAA-MM-DD (horário local)
  function hojeISO() {
    const hoje = new Date();
    hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
    return hoje.toISOString().slice(0, 10);
  }

  const digitos = (valor) => String(valor).replace(/\D/g, "");

  // ===== Aviso rápido (toast) =====
  let timerToast = null;
  function mostrarToast(mensagem, erro = false) {
    const toast = $("toast");
    toast.textContent = mensagem;
    toast.classList.toggle("erro", erro);
    toast.classList.add("visivel");
    clearTimeout(timerToast);
    timerToast = setTimeout(() => toast.classList.remove("visivel"), 3000);
  }

  // ===== Confirmação (substitui o window.confirm) =====
  // Uso: if (await AACD.util.confirmar("Remover?", "Remover")) { ... }
  // Para ações que não são destrutivas: confirmar("Aceitar?", "Aceitar", false)
  function confirmar(mensagem, textoBotao = "Confirmar", perigo = true) {
    const dialogo = $("dialogo-confirmar");
    const botaoOk = $("dialogo-confirmar-ok");
    $("dialogo-confirmar-texto").textContent = mensagem;
    botaoOk.textContent = textoBotao;
    botaoOk.classList.toggle("botao--perigo-cheio", perigo);
    botaoOk.classList.toggle("botao--escuro", !perigo);
    dialogo.returnValue = "";
    dialogo.showModal();
    return new Promise((resolver) => {
      dialogo.addEventListener("close", () => resolver(dialogo.returnValue === "sim"), { once: true });
    });
  }

  // ===== Detalhes que abrem dentro de um cartão =====
  // O botão tem aria-controls apontando para o bloco escondido.
  function alternarDetalhes(botao, textoFechado) {
    const alvo = document.getElementById(botao.getAttribute("aria-controls"));
    const abrir = alvo.hidden;
    alvo.hidden = !abrir;
    botao.setAttribute("aria-expanded", String(abrir));
    botao.textContent = abrir ? "Fechar" : textoFechado;
  }

  // Monta um <dl> a partir de pares [rótulo, valor] (valores já escapados)
  function listaDescricao(pares) {
    return `<dl>${pares.map(([rotulo, valor]) => `<dt>${rotulo}</dt><dd>${valor || "-"}</dd>`).join("")}</dl>`;
  }

  // ===== Armazenamento local seguro (pode falhar em aba anônima) =====
  const armazenamento = {
    ler(chave, area = localStorage) {
      try { return JSON.parse(area.getItem(chave)); } catch { return null; }
    },
    gravar(chave, valor, area = localStorage) {
      try { area.setItem(chave, JSON.stringify(valor)); return true; } catch { return false; }
    },
    apagar(chave, area = localStorage) {
      try { area.removeItem(chave); } catch { /* sem armazenamento disponível */ }
    }
  };

  // ===== Sessão do usuário logado (só para exibir nome e perfil) =====
  // A permissão de verdade é verificada no servidor pelo cookie de sessão.
  const sessao = {
    salvar(usuario) { armazenamento.gravar("aacd_usuario", usuario, sessionStorage); },
    obter() { return armazenamento.ler("aacd_usuario", sessionStorage); },
    limpar() { armazenamento.apagar("aacd_usuario", sessionStorage); }
  };

  // ===== Máscaras =====
  const mascaras = {
    cep: (v) => digitos(v).slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2"),
    telefone: (v) => {
      const d = digitos(v).slice(0, 11);
      if (d.length <= 10) return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
      return d.replace(/^(\d{2})(\d{5})(\d)/, "($1) $2-$3");
    },
    cpf: (v) => {
      const d = digitos(v).slice(0, 11);
      if (d.length <= 3) return d;
      if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
      if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
      return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
    },
    cnpj: (v) => digitos(v).slice(0, 14)
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2")
  };

  const emailValido = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());

return {
  $, escapar, formatarData, formatarDataHora, hojeISO, digitos,
  mostrarToast, confirmar, alternarDetalhes, listaDescricao,
  armazenamento, sessao, mascaras, emailValido
};
})();
