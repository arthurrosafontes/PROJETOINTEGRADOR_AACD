/* =========================================================
   telas/meu-perfil.js — mostra os dados da conta e troca a foto de perfil
   ========================================================= */
"use strict";

(() => {
  const { $, escapar, mascaras, mostrarToast } = AACD.util;

  // Lista de [rótulo, valor] de acordo com o tipo de conta
  function dadosDaConta(u) {
    const dados = [
      ["Nome", u.nome],
      ["E-mail", u.email],
      ["Telefone", u.telefone && mascaras.telefone(u.telefone)],
      ["Conta", u.perfil === "funcionario" ? "Funcionário AACD" : "Voluntário"]
    ];

    if (u.perfil === "funcionario") {
      dados.push(
        ["Setor", u.setor],
        ["Cargo", u.cargo]
      );
    } else {
      dados.push(
        ["Tipo", u.tipo_voluntario],
        ["CPF/CNPJ", u.cpf_cnpj && (u.cpf_cnpj.length > 11 ? mascaras.cnpj(u.cpf_cnpj) : mascaras.cpf(u.cpf_cnpj))],
        ["Razão social", u.razao_social],
        ["Endereço", [u.logradouro, u.numero, u.complemento, u.bairro].filter(Boolean).join(", ")],
        ["Cidade", [u.cidade, u.estado].filter(Boolean).join(" / ")],
        ["CEP", u.cep && mascaras.cep(u.cep)],
        ["Cadastro de voluntário", u.status_homologacao]
      );
    }
    return dados;
  }

  // Mostra a foto salva no servidor (sem foto, fica só o círculo vazio)
  function mostrarFoto(temFoto) {
    if (temFoto) $("perfil-foto").src = AACD.api.urlFotoPerfil();
    else $("perfil-foto").removeAttribute("src");
  }

  async function trocarFoto(e) {
    const arquivo = e.target.files[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (!arquivo) return;
    try {
      await AACD.api.enviarFotoPerfil(arquivo);
      mostrarFoto(true);
      mostrarToast("Foto atualizada.");
    } catch (erro) {
      mostrarToast(erro.message, true);
    }
  }

  AACD.telas["tela-meu-perfil"] = {
    iniciar() {
      $("perfil-arquivo").addEventListener("change", trocarFoto);
    },

    // Roda toda vez que o usuário abre a tela
    async aoEntrar() {
      try {
        const usuario = await AACD.api.meuPerfil();
        // escapar() impede que um texto vindo do banco vire HTML na tela
        $("perfil-dados").innerHTML = dadosDaConta(usuario)
          .map(([rotulo, valor]) => `<dt>${rotulo}</dt><dd>${escapar(valor || "-")}</dd>`)
          .join("");
        mostrarFoto(usuario.temFoto);
      } catch (erro) {
        mostrarToast(erro.message, true);
      }
    }
  };
})();
