/* =========================================================
   telas/cadastro-voluntario.js — cadastro em 3 etapas
   (trilha de etapas, máscaras, validações, CEP e envio)
   ========================================================= */
"use strict";

(() => {
  const { $, digitos, mascaras, emailValido } = AACD.util;

  const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
  const TOTAL = 3; // etapas com campos (a 4ª é a mensagem de sucesso)

  // ---------- Validação de documentos ----------
  function cpfValido(valor) {
    const cpf = digitos(valor);
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    const digito = (tamanho) => {
      const soma = [...cpf.slice(0, tamanho)].reduce((acc, d, i) => acc + Number(d) * (tamanho + 1 - i), 0);
      const resto = (soma * 10) % 11;
      return resto === 10 ? 0 : resto;
    };
    return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
  }

  function cnpjValido(valor) {
    const c = digitos(valor);
    if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
    const calc = (n) => {
      let soma = 0, pos = n - 7;
      for (let i = n; i >= 1; i--) {
        soma += Number(c[n - i]) * pos--;
        if (pos < 2) pos = 9;
      }
      const r = soma % 11;
      return r < 2 ? 0 : 11 - r;
    };
    return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
  }

  // Mostra/limpa o erro de um campo (mensagem fica no <small> do aria-describedby)
  function definirErro(campo, mensagem) {
    const span = $(`${campo.id}-erro`);
    if (span) span.textContent = mensagem;
    campo.setAttribute("aria-invalid", mensagem ? "true" : "false");
    return !mensagem;
  }

  AACD.telas["tela-cadastro-voluntario"] = {
    iniciar() {
      const form = $("form-cadastro");
      const tipo = $("cad-tipo");
      const documento = $("cad-documento");
      const etapas = form.querySelectorAll(".etapa-form");
      const migalhas = $("cad-trilha").querySelectorAll("li");
      const btnAnterior = $("cad-anterior");
      const btnProximo = $("cad-proximo");
      const erroEnvio = $("cad-erro-envio");
      let etapa = 0;

      UFS.forEach(uf => $("cad-uf").add(new Option(uf, uf)));

      // ---------- Regras de cada etapa ----------
      const regras = {
        0: [
          ["cad-tipo", v => v !== "" || "Selecione o tipo de voluntário."],
          ["cad-nome", v => v.trim().length >= 3 || "Informe o nome do voluntário."],
          ["cad-email", v => emailValido(v) || "Email inválido."],
          ["cad-documento", v => {
            if (!tipo.value) return "Selecione primeiro o tipo de voluntário.";
            return tipo.value === "Pessoa fisica" ? (cpfValido(v) || "CPF inválido.") : (cnpjValido(v) || "CNPJ inválido.");
          }],
          ["cad-telefone", v => digitos(v).length >= 10 || "Telefone inválido."]
        ],
        1: [
          ["cad-cep", v => digitos(v).length === 8 || "CEP inválido."],
          ["cad-rua", v => v.trim() !== "" || "Informe a rua."],
          ["cad-numero", v => v.trim() !== "" || "Informe o número."],
          ["cad-bairro", v => v.trim() !== "" || "Informe o bairro."],
          ["cad-cidade", v => v.trim() !== "" || "Informe a cidade."],
          ["cad-uf", v => v !== "" || "Selecione a UF."]
        ],
        2: [
          ["cad-senha", v => v.length >= 8 || "A senha precisa ter ao menos 8 caracteres."],
          ["cad-confirmar", v => v === $("cad-senha").value || "As senhas não coincidem."]
        ]
      };

      function validarEtapa(n) {
        let primeiroInvalido = null;
        (regras[n] || []).forEach(([id, regra]) => {
          const campo = $(id);
          const resultado = regra(campo.value);
          if (!definirErro(campo, resultado === true ? "" : resultado) && !primeiroInvalido) primeiroInvalido = campo;
        });
        if (primeiroInvalido) primeiroInvalido.focus();
        return !primeiroInvalido;
      }

      // ---------- Navegação entre etapas ----------
      function irPara(n, focar = true) {
        etapa = n;
        erroEnvio.textContent = "";
        etapas.forEach(e => { e.hidden = Number(e.dataset.etapa) !== n; });
        migalhas.forEach(li => {
          const i = Number(li.dataset.etapa ?? li.querySelector("button").dataset.etapa);
          const botao = li.querySelector("button");
          li.classList.toggle("concluida", i < n && n < TOTAL);
          if (i === n) botao.setAttribute("aria-current", "step");
          else botao.removeAttribute("aria-current");
          botao.disabled = !(i < n && n < TOTAL) && i !== n;
        });
        btnAnterior.hidden = !(n > 0 && n < TOTAL);
        btnProximo.textContent = n === TOTAL - 1 ? "Cadastrar" : "Próximo";
        $("cad-acoes").hidden = n === TOTAL;
        if (!focar) return;
        const primeiro = n === TOTAL ? $("cad-sucesso-titulo") : etapas[n].querySelector("input:not(:disabled), select");
        if (primeiro) primeiro.focus();
      }
      this.irPara = irPara;

      migalhas.forEach(li => li.querySelector("button").addEventListener("click", (e) => {
        const i = Number(e.currentTarget.dataset.etapa);
        if (i < etapa) irPara(i); // só volta para etapas já concluídas
      }));
      btnAnterior.addEventListener("click", () => irPara(etapa - 1));

      // ---------- Máscaras ----------
      $("cad-telefone").addEventListener("input", e => { e.target.value = mascaras.telefone(e.target.value); });
      $("cad-cep").addEventListener("input", e => { e.target.value = mascaras.cep(e.target.value); });
      documento.addEventListener("input", e => {
        e.target.value = tipo.value === "Pessoa fisica" ? mascaras.cpf(e.target.value) : mascaras.cnpj(e.target.value);
      });

      // ---------- CPF / CNPJ conforme o tipo de voluntário ----------
      tipo.addEventListener("change", () => {
        const pessoaFisica = tipo.value === "Pessoa fisica";
        documento.disabled = !tipo.value;
        documento.value = "";
        documento.maxLength = pessoaFisica ? 14 : 18;
        documento.placeholder = pessoaFisica ? "CPF: 000.000.000-00"
          : tipo.value ? "CNPJ: 00.000.000/0000-00" : "Selecione o tipo de voluntário";
        $("cad-documento-rotulo").textContent = pessoaFisica ? "CPF" : tipo.value ? "CNPJ" : "CPF ou CNPJ";
        definirErro(tipo, "");
        definirErro(documento, "");
      });

      // ---------- Preenchimento do endereço pelo CEP ----------
      const cepStatus = $("cad-cep-status");
      $("cad-cep").addEventListener("input", async (e) => {
        const cep = digitos(e.target.value);
        if (cep.length !== 8) { cepStatus.textContent = ""; return; }
        cepStatus.textContent = "Buscando...";
        try {
          const endereco = await AACD.api.buscarCep(cep);
          if (!endereco) throw new Error();
          $("cad-rua").value = endereco.rua;
          $("cad-bairro").value = endereco.bairro;
          $("cad-cidade").value = endereco.cidade;
          $("cad-uf").value = endereco.uf;
          cepStatus.textContent = "✓";
          definirErro(e.target, "");
          $("cad-numero").focus();
        } catch {
          cepStatus.textContent = "";
          definirErro(e.target, "CEP não encontrado. Preencha o endereço manualmente.");
        }
      });

      // Corrigiu o campo? some o erro.
      form.addEventListener("input", (e) => {
        if (e.target.getAttribute("aria-invalid") === "true") definirErro(e.target, "");
      });

      // ---------- Envio ----------
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!validarEtapa(etapa)) return;
        if (etapa < TOTAL - 1) return irPara(etapa + 1);

        const dados = Object.fromEntries(new FormData(form));
        dados.documento = documento.value;

        btnProximo.disabled = true;
        btnProximo.textContent = "Enviando...";
        try {
          await AACD.api.cadastrarVoluntario(dados);
          form.reset();
          documento.disabled = true;
          irPara(TOTAL);
        } catch (erro) {
          erroEnvio.textContent = erro.message;
        } finally {
          btnProximo.disabled = false;
          if (etapa !== TOTAL) btnProximo.textContent = "Cadastrar";
        }
      });

      irPara(0, false);
    },

    // Ao voltar para a tela depois de um cadastro concluído, começa de novo
    aoEntrar() {
      if (!$("cad-acoes").hidden) return;
      this.irPara(0, false);
    }
  };
})();
