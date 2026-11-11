-- Preserva os recebimentos anteriores, que só permitiam aprovação.
ALTER TABLE recebimento_pedido
  ADD COLUMN resultado ENUM('Aprovada','Reprovada') NOT NULL DEFAULT 'Aprovada';
ALTER TABLE demanda
  MODIFY COLUMN status ENUM('Rascunho','Aberta','Em produção','Aguardando validação','Concluída','Cancelada','Aceita','Reprovada')
  COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Rascunho';
