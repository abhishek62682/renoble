// pm2 process file: `pm2 start ecosystem.config.cjs && pm2 save`
// Works from any folder: paths are resolved relative to this file.
const path = require("path");

module.exports = {
  apps: [{
    name: "renoble-api",
    script: "index.js",
    cwd: __dirname,
    node_args: `--env-file=${path.join(__dirname, ".env.production")}`,
    instances: 1,
    autorestart: true,
    max_memory_restart: "300M",
  }],
};
