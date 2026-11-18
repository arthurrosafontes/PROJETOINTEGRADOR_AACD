// Ciclo de vida do status da prótese (o navegador nunca escolhe o status):
//   cadastro                          -> 'Inativa'
//   demanda criada com a prótese      -> 'Inativa' vira 'Revisão'
//   voluntário aceita essa demanda    -> 'Revisão' vira 'Ativa'
// Só muda se a prótese estiver no status anterior esperado; devolve true se mudou.
const TRANSICOES_PROTESE = {
  demanda: { de: 'Inativa', para: 'Revisão' },
  aceite: { de: 'Revisão', para: 'Ativa' }
};
async function mudarStatusProtese(conexao, idProtese, evento) {
  const { de, para } = TRANSICOES_PROTESE[evento];
  const [resultado] = await conexao.execute(
    'UPDATE protese SET status = ? WHERE id_protese = ? AND status = ?',
    [para, idProtese, de]
  );
  return resultado.affectedRows > 0;
}

module.exports = { mudarStatusProtese };
