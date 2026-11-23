const _config = {
  port: process.env.PORT || 4000,
  databaseUrl: process.env.MONGO_CONNECTION_STRING,
  env: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET,
  frontendDomainAdmin: process.env.FRONTEND_DOMAIN_ADMIN ? process.env.FRONTEND_DOMAIN_ADMIN.split(",") : [],
};

if (!_config.jwtSecret) throw new Error("JWT_SECRET is not set.");

export const config = Object.freeze(_config);
