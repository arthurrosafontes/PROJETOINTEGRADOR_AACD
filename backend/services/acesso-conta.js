const normalizar = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function verificarAcesso(usuario, perfil) {
  if (!usuario) return 'perfil';
  const tipo = normalizar(usuario.tipo_usuario);
  const perfilCorreto = perfil === 'voluntario'
    ? tipo === 'voluntario' && usuario.id_voluntario != null
    : perfil === 'funcionario' && tipo === 'funcionario aacd' && usuario.id_funcionario != null;
  if (!perfilCorreto) return 'perfil';
  if (normalizar(usuario.status) !== 'ativo') return 'inativo';
  if (perfil === 'voluntario') {
    const homologacao = normalizar(usuario.status_homologacao);
    if (homologacao !== 'aprovado') return homologacao === 'pendente' ? 'pendente' : 'homologacao';
  }
  return null;
}

module.exports = { verificarAcesso };
