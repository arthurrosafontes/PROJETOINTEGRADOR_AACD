CREATE TABLE IF NOT EXISTS aceite_cadastro (
  id_usuario INT NOT NULL,
  versao_termos VARCHAR(24) NOT NULL,
  versao_privacidade VARCHAR(24) NOT NULL,
  aceito_em_utc DATETIME NOT NULL,
  PRIMARY KEY (id_usuario, versao_termos, versao_privacidade),
  CONSTRAINT fk_aceite_cadastro_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
