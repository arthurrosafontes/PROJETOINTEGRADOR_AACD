-- Executar uma vez. Chaves opcionais preservam clientes e registros anteriores.
ALTER TABLE demanda
  MODIFY COLUMN status ENUM('Rascunho','Aberta','Em produção','Aguardando validação','Concluída','Cancelada','Aceita')
    COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Rascunho',
  ADD COLUMN chave_publicacao CHAR(36) CHARACTER SET ascii NULL,
  ADD UNIQUE KEY uq_demanda_publicacao (id_funcionario, chave_publicacao);

-- Só reclassifica demandas com pedido aceito e sem outro pedido ativo já iniciado.
UPDATE demanda d
  JOIN (SELECT id_demanda FROM pedido_producao
         WHERE status <> 'Cancelado'
         GROUP BY id_demanda
         HAVING COUNT(*) = SUM(status = 'Aceito' AND data_inicio IS NULL)) pendente
    ON pendente.id_demanda = d.id_demanda
   SET d.status = 'Aceita'
 WHERE d.status = 'Em produção';
