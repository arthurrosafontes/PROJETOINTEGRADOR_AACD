(function () {
  "use strict";

  const TOTAL_STEPS = 3;
  const DRAFT_KEY = "aacd_nova_demanda_rascunho";

  const form = document.getElementById("demandaForm");
  const steps = Array.from(document.querySelectorAll(".step"));
  const crumbs = Array.from(document.querySelectorAll("#breadcrumb li"));
  const btnVoltar = document.getElementById("btnVoltar");
  const btnAvancar = document.getElementById("btnAvancar");
  const btnPublicar = document.getElementById("btnPublicar");
  const btnRascunho = document.getElementById("btnRascunho");
  const btnCancelar = document.getElementById("btnCancelar");
  const toast = document.getElementById("toast");

  let current = 1;
  let maxReached = 1;
  let toastTimer;

  /* ---------- Navegação entre etapas ---------- */
  function goTo(step) {
    current = step;
    maxReached = Math.max(maxReached, step);

    steps.forEach((s) => { s.hidden = Number(s.dataset.step) !== step; });

    crumbs.forEach((li, i) => {
      const n = i + 1;
      li.classList.toggle("is-current", n === step);
      li.classList.toggle("is-done", n < step || (n !== step && n <= maxReached));
      if (n === step) li.querySelector("button").setAttribute("aria-current", "step");
      else li.querySelector("button").removeAttribute("aria-current");
    });

    btnVoltar.hidden = step === 1;
    btnAvancar.hidden = step === TOTAL_STEPS;
    btnPublicar.hidden = step !== TOTAL_STEPS;

    const first = steps[step - 1].querySelector("input");
    if (first) first.focus({ preventScroll: true });
  }

  /* ---------- Validação ---------- */
  function setError(input, message) {
    const field = input.closest(".field");
    field.classList.toggle("has-error", Boolean(message));
    field.querySelector(".error").textContent = message || "";
    input.setAttribute("aria-invalid", message ? "true" : "false");
  }

  function validateInput(input) {
    const value = input.value.trim();
    if (!value) {
      setError(input, "Preencha este campo.");
      return false;
    }
    if (input.type === "number") {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1) {
        setError(input, "Informe uma quantidade inteira maior que zero.");
        return false;
      }
    }
    setError(input, "");
    return true;
  }

  function validateStep(step) {
    const inputs = Array.from(steps[step - 1].querySelectorAll("input"));
    let firstInvalid = null;
    inputs.forEach((input) => {
      if (!validateInput(input) && !firstInvalid) firstInvalid = input;
    });
    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
  }

  form.addEventListener("input", (e) => {
    if (e.target.matches("input") && e.target.closest(".field").classList.contains("has-error")) {
      validateInput(e.target);
    }
  });

  /* ---------- Botões ---------- */
  btnAvancar.addEventListener("click", () => {
    if (validateStep(current)) goTo(current + 1);
  });

  btnVoltar.addEventListener("click", () => goTo(current - 1));

  crumbs.forEach((li, i) => {
    li.querySelector("button").addEventListener("click", () => {
      const target = i + 1;
      if (target === current) return;
      if (target < current) return goTo(target);
      // avançar pelo breadcrumb só até etapas já visitadas, validando as anteriores
      if (target <= maxReached) {
        for (let s = current; s < target; s++) {
          if (!validateStep(s)) return goTo(s);
        }
        goTo(target);
      }
    });
  });

  /* ---------- Rascunho ---------- */
  function getData() {
    return Object.fromEntries(new FormData(form).entries());
  }

  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ data: getData(), step: current }));
      showToast("Rascunho salvo.");
    } catch (err) {
      showToast("Não foi possível salvar o rascunho neste navegador.");
    }
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const { data, step } = JSON.parse(raw);
      Object.entries(data || {}).forEach(([name, value]) => {
        if (form.elements[name]) form.elements[name].value = value;
      });
      maxReached = Math.max(1, Number(step) || 1);
      goTo(Math.min(maxReached, TOTAL_STEPS));
      showToast("Rascunho recuperado.");
    } catch (err) { /* ignora rascunho inválido */ }
  }

  btnRascunho.addEventListener("click", saveDraft);

  btnCancelar.addEventListener("click", () => {
    const hasData = Object.values(getData()).some((v) => v.trim() !== "");
    if (hasData && !confirm("Descartar as informações preenchidas?")) return;
    form.reset();
    form.querySelectorAll(".field").forEach((f) => {
      f.classList.remove("has-error");
      f.querySelector(".error").textContent = "";
    });
    localStorage.removeItem(DRAFT_KEY);
    maxReached = 1;
    goTo(1);
  });

  /* ---------- Publicar ---------- */
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    for (let s = 1; s <= TOTAL_STEPS; s++) {
      if (!validateStep(s)) return goTo(s);
    }
    const demanda = getData();
    console.log("Demanda publicada:", demanda); // aqui entra o fetch/POST para o back-end
    localStorage.removeItem(DRAFT_KEY);
    showToast("Demanda publicada.");
  });

  /* ---------- Toast ---------- */
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  /* ---------- Início ---------- */
  goTo(1);
  loadDraft();
})();
