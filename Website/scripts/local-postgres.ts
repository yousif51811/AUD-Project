import EmbeddedPostgres from 'embedded-postgres';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Starts a local PostgreSQL instance for development and integration tests.
 *
 * The data directory is kept inside the repository (and git-ignored) so a
 * developer can run the whole stack with `npm run db:local` and no external
 * database service. Production uses a managed PostgreSQL instance instead.
 */
const port = Number(process.env.POSTGRES_PORT ?? 5433);
const user = process.env.POSTGRES_USER ?? 'familymind';
const password = process.env.POSTGRES_PASSWORD ?? 'familymind_local';
const database = process.env.POSTGRES_DATABASE ?? 'familymind';
// The cluster lives outside the watched project tree on purpose: a database
// directory inside the repository makes the development server reload on every
// write.
const dataDir =
  process.env.POSTGRES_DATA_DIR ??
  path.resolve(process.cwd(), 'node_modules', '.cache', 'familymind-postgres');

async function main() {
  const pg = new EmbeddedPostgres({
    port,
    user,
    password,
    databaseDir: dataDir,
    persistent: true,
    authMethod: 'scram-sha-256',
  });

  if (!existsSync(path.join(dataDir, 'PG_VERSION'))) await pg.initialise();
  await pg.start();
  await pg.createDatabase(database).catch(() => undefined);

  console.log(`PostgreSQL running at ${user}:***@127.0.0.1:${port}/${database}`);

  if (process.env.WRITE_ENV === 'true') {
    writeFileSync(
      '.env',
      [
        `DATABASE_URL=postgresql://${user}:${password}@127.0.0.1:${port}/${database}`,
        `DATABASE_URL_UNPOOLED=postgresql://${user}:${password}@127.0.0.1:${port}/${database}`,
        'AUTH_SECRET=' + crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, ''),
        'APP_URL=http://localhost:3000',
        '',
      ].join('\n'),
    );
    console.log('.env written');
  }

  process.on('SIGINT', async () => {
    await pg.stop();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    await pg.stop();
    process.exit(0);
  });

  await new Promise(() => {});
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
