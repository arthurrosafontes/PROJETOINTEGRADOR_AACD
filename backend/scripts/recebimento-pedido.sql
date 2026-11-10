CREATE TABLE IF NOT EXISTS recebimento_pedido (
  id_pedido INT NOT NULL PRIMARY KEY,
  id_usuario INT NOT NULL,
  nome_funcionario VARCHAR(255) NOT NULL,
  foto_arquivo VARCHAR(100) NOT NULL,
  observacoes VARCHAR(2000) NULL,
  data_recebimento DATETIME NOT NULL,
  CONSTRAINT fk_recebimento_pedido FOREIGN KEY (id_pedido) REFERENCES pedido_producao (id_pedido),
  CONSTRAINT fk_recebimento_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
) ENGINE=InnoDB;
