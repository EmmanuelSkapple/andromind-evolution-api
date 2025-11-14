module.exports = {
  apps: [
    {
      name: "evolution-api",
      script: "npm",
      args: "run dev:server",
      env: {
        NODE_ENV: "production",
        ...require('dotenv').config().parsed
      }
    }
  ]
}
