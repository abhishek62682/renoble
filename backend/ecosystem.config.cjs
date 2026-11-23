// pm2 process file: `pm2 start ecosystem.config.cjs && pm2 save`
module.exports = {
  apps: [{
    name: "renoble-api",
    script: "index.js",
    node_args: "--env-file=./.env.production",
    instances: 1,
    autorestart: true,
    max_memory_restart: "300M",
  }],
};
