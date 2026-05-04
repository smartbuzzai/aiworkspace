const REQUIRED_COMMON = [
  "DATABASE_URL",
  "REDIS_URL",
  "JWT_SECRET",
];

const REQUIRED_API = [
  ...REQUIRED_COMMON,
  "SESSION_SECRET",
  "APP_URL",
  "S3_ENDPOINT",
  "S3_ACCESS_KEY",
  "S3_SECRET_KEY",
];

const REQUIRED_WORKERS = [
  ...REQUIRED_COMMON,
  "S3_ENDPOINT",
  "S3_ACCESS_KEY",
  "S3_SECRET_KEY",
];

const WARNINGS = [
  { key: "OLLAMA_HOST", msg: "Ollama host not set — AI assistant and embeddings will be unavailable" },
  { key: "VAPID_PUBLIC_KEY", msg: "VAPID keys not set — web push notifications will be disabled" },
  { key: "VAPID_PRIVATE_KEY", msg: "VAPID private key not set — web push notifications will be disabled" },
];

export function validateEnv(role = "api") {
  const required = role === "workers" ? REQUIRED_WORKERS : REQUIRED_API;
  const missing = required.filter(k => !process.env[k]);

  if (missing.length > 0) {
    console.error("\n╔══════════════════════════════════════════════════════════╗");
    console.error("║  FATAL: Missing required environment variables          ║");
    console.error("╚══════════════════════════════════════════════════════════╝\n");
    for (const k of missing) {
      console.error(`  ✗  ${k}`);
    }
    console.error("\nCopy .env.example to .env and fill in the values.\n");
    process.exit(1);
  }

  for (const { key, msg } of WARNINGS) {
    if (!process.env[key]) {
      console.warn(`⚠  ${msg}`);
    }
  }

  // Validate URL formats
  for (const key of ["DATABASE_URL", "REDIS_URL", "S3_ENDPOINT"]) {
    if (process.env[key]) {
      try {
        new URL(process.env[key]);
      } catch {
        console.error(`FATAL: ${key} is not a valid URL (value redacted)`);
        process.exit(1);
      }
    }
  }

  console.log(`✓ Environment validated (${role})`);
}
