module.exports = {
  apps: [
    {
      name: 'evolution-api',
      // Usar el build de producción, no dev:server (tsx watch consume +RAM y es inestable en prod)
      script: 'npm',
      args: 'run start:prod',

      // ── Reinicio automático ──────────────────────────────────────────────────
      // Reiniciar inmediatamente si el proceso muere
      autorestart: true,
      // Esperar 3 s antes de reiniciar (evita restart loop si hay error de arranque)
      restart_delay: 3000,
      // Backoff exponencial: si sigue crasheando, PM2 espera más entre reinicios
      exp_backoff_restart_delay: 100,
      // Si el proceso vive menos de 10 s se considera inestable y PM2 para de reiniciar
      min_uptime: '10s',
      // Máximo de reinicios en la ventana de 10 minutos antes de marcar como "errored"
      max_restarts: 15,

      // ── Memoria ─────────────────────────────────────────────────────────────
      // Reiniciar si supera 512 MB (memory leak de Baileys / bull / etc.)
      max_memory_restart: '512M',

      // ── Entorno ─────────────────────────────────────────────────────────────
      env: {
        NODE_ENV: 'production',
      },

      // ── Logs ────────────────────────────────────────────────────────────────
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      // Rotar logs cuando superen 10 MB (requiere pm2-logrotate)
      merge_logs: true,

      // ── Otros ───────────────────────────────────────────────────────────────
      watch: false,          // nunca watch en producción
      instances: 1,          // 1 instancia (Baileys no soporta clustering)
      exec_mode: 'fork',
    },
  ],
};
