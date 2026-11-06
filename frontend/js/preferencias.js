/* =========================================================
   preferencias.js — guarda e aplica as configurações do usuário
   ---------------------------------------------------------
   Carregado no <head> SEM "defer", para aplicar fonte e contraste
   antes de a página aparecer.

   As preferências ficam só no localStorage deste navegador.
   A tela de Configurações (js/telas/configuracoes.js) usa:
     AACD.preferencias.PADRAO      -> valores iniciais
     AACD.preferencias.ler()       -> preferências salvas
     AACD.preferencias.salvar(p)   -> grava e aplica
   ========================================================= */
"use strict";

window.AACD = window.AACD || {};

AACD.preferencias = (() => {
  const CHAVE = "aacd_preferencias";
  const raiz = document.documentElement;

  // Padrões protegem o usuário: nada de marketing ligado sem ele pedir
  const PADRAO = Object.freeze({
    notifAtualizacoes: true,
    canalEmail: true,
    fonte: "100",            // "100" | "115" | "130" (porcentagem)
    altoContraste: false,
    reduzirAnimacoes: false
  });
  const FONTES = ["100", "115", "130"];

  function ler() {
    let salvas = null;
    try { salvas = JSON.parse(localStorage.getItem(CHAVE)); } catch { /* sem armazenamento */ }
    const p = { ...PADRAO };
    if (salvas && typeof salvas === "object") {
      for (const chave of Object.keys(PADRAO)) {
        if (typeof salvas[chave] === typeof PADRAO[chave]) p[chave] = salvas[chave];
      }
    }
    if (!FONTES.includes(p.fonte)) p.fonte = PADRAO.fonte;
    return p;
  }

  function salvar(p) {
    try { localStorage.setItem(CHAVE, JSON.stringify(p)); } catch { return false; }
    aplicar(p);
    return true;
  }

  // Aplica tudo como atributos no <html>; o CSS faz o resto
  function aplicar(p) {
    const atuais = { ...PADRAO, ...p };
    raiz.style.setProperty("--escala-fonte", String(Number(atuais.fonte) / 100 || 1));
    if (atuais.altoContraste) raiz.dataset.contraste = "alto"; else delete raiz.dataset.contraste;
    if (atuais.reduzirAnimacoes) raiz.dataset.movimento = "reduzido"; else delete raiz.dataset.movimento;
  }

  // ===== Rótulos para leitores de tela (sempre ligado) =====
  // Dá nome acessível a botões, links e campos que só têm ícone ou placeholder.
  const SELETOR = "button, a[href], [role='button'], input:not([type='hidden']), select, textarea";

  function temNomeAcessivel(el) {
    if (el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby")) return true;
    if (el.matches("input, select, textarea")) return el.labels && el.labels.length > 0;
    return el.textContent.trim() !== "" || Boolean(el.querySelector("img[alt]:not([alt=''])"));
  }

  function rotular() {
    document.querySelectorAll(SELETOR).forEach(el => {
      if (temNomeAcessivel(el)) return;
      const nome = el.getAttribute("title") || el.getAttribute("placeholder") || el.getAttribute("name");
      if (nome) el.setAttribute("aria-label", nome);
    });
  }

  // As listas são montadas por JavaScript; rotula também o que aparecer depois
  let agendado = false;
  document.addEventListener("DOMContentLoaded", () => {
    rotular();
    new MutationObserver(() => {
      if (agendado) return;
      agendado = true;
      requestAnimationFrame(() => { agendado = false; rotular(); });
    }).observe(document.body, { childList: true, subtree: true });
  });

  aplicar(ler());

  return { PADRAO, ler, salvar };
})();
