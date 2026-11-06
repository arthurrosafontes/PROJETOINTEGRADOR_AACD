CREATE TABLE IF NOT EXISTS envio_pedido (
  id_pedido INT NOT NULL PRIMARY KEY,
  modalidade ENUM('Envio pelos Correios','Voluntário entrega na unidade','Retirada pela equipe') NOT NULL,
  data_envio DATE NOT NULL,
  codigo_rastreio VARCHAR(80) NULL,
  funcionario_recebedor VARCHAR(150) NULL,
  observacoes VARCHAR(1000) NULL,
  CONSTRAINT fk_envio_pedido FOREIGN KEY (id_pedido) REFERENCES pedido_producao (id_pedido),
  CONSTRAINT chk_envio_comprovacao CHECK (
    (modalidade = 'Envio pelos Correios' AND codigo_rastreio IS NOT NULL AND CHAR_LENGTH(TRIM(codigo_rastreio)) > 0 AND funcionario_recebedor IS NULL)
    OR (modalidade <> 'Envio pelos Correios' AND funcionario_recebedor IS NOT NULL AND CHAR_LENGTH(TRIM(funcionario_recebedor)) > 0 AND codigo_rastreio IS NULL)
  )
) ENGINE=InnoDB;
