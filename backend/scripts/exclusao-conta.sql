CREATE TABLE IF NOT EXISTS exclusao_conta (
  protocolo CHAR(36) NOT NULL PRIMARY KEY,
  id_usuario INT NULL,
  estado ENUM('limpeza','revisao','concluida') NOT NULL,
  solicitado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  concluido_em DATETIME NULL,
  proxima_tentativa DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_exclusao_usuario (id_usuario),
  KEY idx_exclusao_fila (estado, proxima_tentativa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
