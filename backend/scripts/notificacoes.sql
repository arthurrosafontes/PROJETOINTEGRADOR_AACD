CREATE TABLE IF NOT EXISTS preferencia_notificacao (
  id_usuario INT PRIMARY KEY,
  hub BOOLEAN NOT NULL DEFAULT TRUE,
  email BOOLEAN NOT NULL DEFAULT FALSE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notificacao (
  id CHAR(36) PRIMARY KEY,
  id_usuario INT NOT NULL,
  evento VARCHAR(120) NOT NULL,
  mensagem VARCHAR(500) NOT NULL,
  link VARCHAR(100) NOT NULL,
  popup BOOLEAN NOT NULL,
  exibida BOOLEAN NOT NULL DEFAULT FALSE,
  email_estado ENUM('pendente','enviado','ignorado','falhou') NOT NULL,
  tentativas TINYINT UNSIGNED NOT NULL DEFAULT 0,
  proxima_tentativa DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_notificacao_evento (id_usuario, evento),
  KEY idx_notificacao_hub (id_usuario, popup, exibida, criada),
  KEY idx_notificacao_email (email_estado, proxima_tentativa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
