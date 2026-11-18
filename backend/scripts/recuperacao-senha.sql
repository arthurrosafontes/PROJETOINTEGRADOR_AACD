CREATE TABLE IF NOT EXISTS recuperacao_senha (
  id_usuario INT NOT NULL PRIMARY KEY,
  codigo_hash BINARY(32) NULL,
  autorizacao_hash BINARY(32) NULL,
  tentativas TINYINT UNSIGNED NOT NULL DEFAULT 0,
  enviada_em DATETIME NOT NULL,
  expira_em DATETIME NOT NULL,
  CONSTRAINT fk_recuperacao_senha_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuario (id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
