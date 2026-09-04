import { readFileSync } from "node:fs";

const checks = [
  {
    path: "deploy/production/env/starlitsky-api.env.example",
    includes: [
      "NODE_ENV=production",
      "API_HOST=127.0.0.1",
      "API_PORT=8080",
      'DATABASE_URL="file:/opt/starlitsky/data/starlitsky.sqlite"',
      "CORS_ALLOWED_ORIGINS=https://admin.__DOMAIN__",
      "WECHAT_MOCK_LOGIN_ENABLED=false",
      "WECHAT_MOCK_QR_ENABLED=false",
      "STORAGE_MAX_IMAGE_BYTES=10485760",
    ],
    excludes: ["CORS_ALLOWED_ORIGINS=*"],
  },
  {
    path: "deploy/production/env/admin-build.env.example",
    includes: ["VITE_API_BASE_URL=https://api.__DOMAIN__"],
  },
  {
    path: "deploy/production/systemd/starlitsky-api.service",
    includes: [
      "EnvironmentFile=/etc/starlitsky/starlitsky-api.env",
      "Environment=NODE_ENV=production",
      "Environment=API_HOST=127.0.0.1",
      "Restart=on-failure",
      "ExecStart=/usr/bin/node /opt/starlitsky/app/services/api/src/server.mjs",
    ],
  },
  {
    path: "deploy/production/nginx/starlitsky.conf.template",
    includes: [
      "server_name admin.__DOMAIN__;",
      "server_name api.__DOMAIN__;",
      "server 127.0.0.1:8080;",
      "return 308 https://$host$request_uri;",
      "root /opt/starlitsky/app/dist/admin;",
      "try_files $uri $uri/ /index.html;",
      "proxy_pass http://starlitsky_api;",
      "proxy_set_header Host $host;",
      "proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;",
      "client_max_body_size 10m;",
    ],
    excludes: ["add_header Access-Control-Allow-Origin *"],
  },
  {
    path: "deploy/production/scripts/backup-sqlite.sh",
    includes: [".backup", "RETENTION_DAYS", "Retention skipped: only one backup exists."],
    excludes: [" cp ", "rsync", "scp ", "ssh "],
  },
  {
    path: "deploy/production/scripts/install-build-migrate-restart.sh",
    includes: [
      "run_bun install --frozen-lockfile",
      "npm run verify:production-env",
      "run_bun run --cwd services/api db:generate",
      "run_bun run --cwd services/api db:migrate:deploy",
      "npm run build:admin",
      "systemctl restart",
      "health-check.sh",
    ],
    excludes: ["ssh ", "scp ", "docker"],
  },
];

const forbiddenSecretPatterns = [
  /AKID[A-Za-z0-9]{16,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/,
  /secretid\s*=\s*[^_\s]/i,
  /secretkey\s*=\s*[^_\s]/i,
];

const failures = [];

for (const check of checks) {
  const text = readFileSync(check.path, "utf8");
  for (const expected of check.includes ?? []) {
    if (!text.includes(expected)) {
      failures.push(`${check.path} is missing expected text: ${expected}`);
    }
  }
  for (const forbidden of check.excludes ?? []) {
    if (text.includes(forbidden)) {
      failures.push(`${check.path} contains forbidden text: ${forbidden}`);
    }
  }
  for (const pattern of forbiddenSecretPatterns) {
    if (pattern.test(text)) {
      failures.push(`${check.path} appears to contain a real secret pattern: ${pattern}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Deployment asset verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Deployment asset verification passed.");
