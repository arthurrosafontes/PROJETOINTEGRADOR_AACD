/**
 * Tela Inicial – Seleção do tipo de login (AACD)
 *
 * IDs esperados no HTML:
 *   #btn-funcionario  -> botão "Funcionário AACD"
 *   #btn-voluntario   -> botão "Voluntário"
 *   #link-sobre       -> link "O Que é a AACD?"
 */

document.addEventListener("DOMContentLoaded", () => {
  // ===== Configuração das rotas (ajuste para as páginas do seu projeto) =====
  const ROTAS = {
    funcionario: "login-funcionario.html",
    voluntario: "login-voluntario.html",
  };

  const btnFuncionario = document.getElementById("btn-funcionario");
  const btnVoluntario = document.getElementById("btn-voluntario");
  const linkSobre = document.getElementById("link-sobre");

  // ===== Seleção do tipo de login =====
  function selecionarLogin(tipo, botao) {
    // Guarda o tipo escolhido para a próxima tela saber qual login exibir
    try {
      sessionStorage.setItem("tipoLogin", tipo);
    } catch (e) {
      /* armazenamento indisponível: segue sem salvar */
    }

    // Feedback visual antes de trocar de página
    if (botao) {
      botao.classList.add("selecionado");
      botao.setAttribute("aria-busy", "true");
      botao.disabled = true;
    }

    setTimeout(() => {
      window.location.href = ROTAS[tipo];
    }, 250);
  }

  if (btnFuncionario) {
    btnFuncionario.addEventListener("click", () =>
      selecionarLogin("funcionario", btnFuncionario)
    );
  }

  if (btnVoluntario) {
    btnVoluntario.addEventListener("click", () =>
      selecionarLogin("voluntario", btnVoluntario)
    );
  }

  // ===== Modal "O Que é a AACD?" =====
  const modal = criarModalSobre();

  if (linkSobre) {
    linkSobre.addEventListener("click", (e) => {
      e.preventDefault();
      abrirModal();
    });
  }

  function criarModalSobre() {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
        <button type="button" class="modal-fechar" aria-label="Fechar">&times;</button>
        <h2 id="modal-titulo">O Que é a AACD?</h2>
        <p>
          A AACD (Associação de Assistência à Criança Deficiente) é uma instituição
          sem fins lucrativos que atua há décadas no tratamento, reabilitação e
          reintegração social de pessoas com deficiência física.
        </p>
        <p>
          Além dos centros de reabilitação, mantém o Hospital Ortopédico AACD,
          referência em cirurgias ortopédicas.
        </p>
        <a href="https://aacd.org.br" target="_blank" rel="noopener">Saiba mais</a>
      </div>
    `;

    // Estilos mínimos do modal (remova se já tiver no seu CSS)
    const estilo = document.createElement("style");
    estilo.textContent = `
      .modal-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,.55);
        display: flex; align-items: center; justify-content: center;
        z-index: 1000; padding: 16px;
      }
      .modal-overlay[hidden] { display: none; }
      .modal {
        position: relative; background: #fff; color: #333;
        max-width: 420px; width: 100%; border-radius: 16px;
        padding: 28px 24px; font-family: inherit;
        box-shadow: 0 10px 30px rgba(0,0,0,.25);
      }
      .modal h2 { margin-top: 0; color: #12a5a5; }
      .modal a { color: #e30613; font-weight: bold; }
      .modal-fechar {
        position: absolute; top: 10px; right: 14px; border: none;
        background: none; font-size: 26px; cursor: pointer; color: #666;
      }
      .selecionado { transform: scale(.97); opacity: .8; transition: .2s; }
    `;
    document.head.appendChild(estilo);
    document.body.appendChild(overlay);

    overlay.querySelector(".modal-fechar").addEventListener("click", fecharModal);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) fecharModal();
    });

    return overlay;
  }

  function abrirModal() {
    modal.hidden = false;
    modal.querySelector(".modal-fechar").focus();
    document.addEventListener("keydown", fecharComEsc);
  }

  function fecharModal() {
    modal.hidden = true;
    document.removeEventListener("keydown", fecharComEsc);
    if (linkSobre) linkSobre.focus();
  }

  function fecharComEsc(e) {
    if (e.key === "Escape") fecharModal();
  }

  // ===== Ao voltar para esta tela (botão "voltar" do navegador) =====
  window.addEventListener("pageshow", () => {
    [btnFuncionario, btnVoluntario].forEach((b) => {
      if (!b) return;
      b.disabled = false;
      b.classList.remove("selecionado");
      b.removeAttribute("aria-busy");
    });
  });
});