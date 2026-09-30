// Offline preflight only. Never loads .dev.vars or contacts a provider.
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

const [environment, secretsFile] = process.argv.slice(2);
const fail = (message) => { console.error(`Release configuration: ${message}`); process.exit(1); };
if (!['staging', 'production'].includes(environment) || !secretsFile) {
  fail('usage: node scripts/check-release-env.mjs <staging|production> <explicit-env-file>');
}
try {
  const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
  const target = config.env?.[environment];
  if (!target) fail(`wrangler environment ${environment} is not configured; deployment remains an operational gate.`);
  const secrets = parseEnv(readFileSync(secretsFile, 'utf8'));
  if (target.vars?.APP_ENV !== environment) fail('APP_ENV must match the selected environment.');
  const origin = new URL(target.vars?.BETTER_AUTH_URL || '');
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
    fail('BETTER_AUTH_URL must be an HTTPS origin without credentials, path, query, or fragment.');
  }
  if ((secrets.BETTER_AUTH_SECRET || '').trim().length < 32) fail('BETTER_AUTH_SECRET must contain at least 32 characters.');
  if (!(secrets.KAKAO_CLIENT_ID || '').trim()) fail('KAKAO_CLIENT_ID is required for Web account access.');
  if (!target.hyperdrive?.some((binding) => binding.binding === 'HYPERDRIVE' && /^[a-f0-9]{32}$/i.test(binding.id))) {
    fail('a HYPERDRIVE binding is required.');
  }
  const observability = target.observability ?? config.observability;
  if (observability?.logs?.invocation_logs !== false || observability?.traces?.enabled !== false) {
    fail('URL-bearing invocation logs and automatic traces must be disabled.');
  }
  console.log('Offline release configuration passed. Remote secrets, OAuth callbacks, database privileges, migrations and deployed behavior still require authorized operational verification.');
} catch {
  fail('unable to validate the explicit configuration files; values are never printed.');
}
