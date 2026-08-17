# Turkuvaz İnşaat Website

A database-driven construction company website built with Next.js 15, TypeScript, Tailwind CSS 4, Prisma, and Cloudflare R2. SQLite is supported for local development; production deployments use PostgreSQL.

## Database setup

Prisma providers are fixed when the client is generated, so the project keeps two model-identical schemas with provider-specific datasource configuration:

- `prisma/schema.prisma` — production PostgreSQL schema and migrations
- `prisma/sqlite/schema.prisma` — local SQLite schema and migrations

When a model changes, apply the same model change to both schema files. Mode-specific scripts regenerate `@prisma/client` before Next.js starts, so `src/lib/prisma.ts` always receives a client built for the selected datasource. Stop the running dev server before switching modes; Windows cannot replace Prisma's engine while the old server is using it.

### Local development with SQLite

Create `.env` from `.env.example`. Keep the default local setting:

```dotenv
DATABASE_URL="file:./dev.db"
```

The relative URL resolves consistently to `prisma/dev.db`. Neither command below seeds, resets, replaces, or deletes that file:

```bash
npm install
npm run dev
# Equivalent explicit command:
npm run dev:sqlite
```

Both commands generate the SQLite Prisma client before starting Next.js. To generate without starting the server, run `npm run prisma:generate:sqlite`.

`db:push` is the safest way to keep an existing pre-migration SQLite database in sync without deleting its CMS content. For a new SQLite database, or after the database has joined the checked-in migration history, use Prisma Migrate:

```bash
npm run prisma:migrate:dev -- --name describe_the_change
```

Do not accept a Prisma reset prompt for a local database containing content you need. Back it up first or continue to use `npm run db:push` for that legacy database.

### Local PostgreSQL testing with Neon

Keep `.env` pointed at SQLite. In the PowerShell session used for the PostgreSQL test, set Neon's pooled URL for application traffic and its direct URL for Prisma operations:

```powershell
$env:DATABASE_URL = "postgresql://NEON_POOLED_URL"
$env:DIRECT_URL = "postgresql://NEON_DIRECT_URL"
npm run dev:pg
```

`dev:pg` rejects `file:` URLs, generates from `prisma/schema.prisma`, then starts Next.js with the same environment. It does not run migrations or seed. Test the production build in the same shell with:

```powershell
npm run build:pg
```

When finished, clear the temporary overrides so `npm run dev` returns to `.env` and SQLite:

```powershell
Remove-Item Env:DATABASE_URL
Remove-Item Env:DIRECT_URL
npm run dev
```

Do not run SQLite and PostgreSQL modes simultaneously from the same checkout because they share the generated `@prisma/client` directory.

### Vercel production deployment

Set these Vercel environment variables for Production and any Preview environment that should use Neon:

```dotenv
DATABASE_URL="postgresql://NEON_POOLED_URL"
DIRECT_URL="postgresql://NEON_DIRECT_URL"
```

Keep Neon's required SSL and pooling parameters intact and never commit either URL. Use `npm run build:pg` as the Vercel Build Command. Apply checked-in migrations separately before serving a schema change:

```bash
npm run prisma:migrate:deploy
npm run build:pg
```

`prisma migrate deploy` uses the direct URL configured in the PostgreSQL schema. It applies existing migrations without creating migrations, resetting data, or running seed. Run it in a controlled deployment/CI step, not concurrently from application instances. For future production schema changes, create PostgreSQL migrations against a development PostgreSQL database:

```bash
npx prisma migrate dev --schema prisma/schema.prisma --name describe_the_change
```

The initial migration creates the existing models without changing their data structure. Schema migration commands do not copy rows between databases.

## Copy existing SQLite data to PostgreSQL

The one-time data migration reads `prisma/dev.db` in SQLite read-only mode and connects to PostgreSQL only through `POSTGRES_DATABASE_URL`. It never uses `DATABASE_URL` for the SQLite source, runs seed, changes schemas, uploads files, or calls R2. Image, video, PDF, and other stored URLs are copied byte-for-byte as database strings.

Before starting, stop the local development server so the SQLite content cannot change during the copy. Keep a separate backup of `prisma/dev.db` as an additional precaution.

Configure the Neon target without replacing the local SQLite `DATABASE_URL` used by the application:

```dotenv
DATABASE_URL="file:./dev.db"
POSTGRES_DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
DIRECT_URL="postgresql://NEON_DIRECT_URL"
```

Use this order:

1. Apply the PostgreSQL schema first. Run this with `DATABASE_URL` set to the Neon connection string in that shell or deployment environment:

   ```bash
   npm run prisma:migrate:deploy
   ```

2. Restore local `DATABASE_URL="file:./dev.db"` if it was changed, then inspect the read-only plan:

   ```bash
   npm run migrate:data:pg:dry-run
   ```

3. Only after the dry-run succeeds and its counts look correct, perform the atomic upsert:

   ```bash
   npm run migrate:data:pg
   ```

The real migration preserves IDs, timestamps, status flags, ordering, relations, credentials, and stored URLs. Existing PostgreSQL rows with matching IDs are updated; identical rows are skipped; missing rows are created. The migration runs in one PostgreSQL transaction and verifies every model's count and scalar values before commit. It never deletes target rows. If PostgreSQL contains extra IDs or conflicting unique values, the safety check aborts and asks you to resolve them instead of deleting or replacing anything.

Both modes print source counts, target counts, and create/update/skip totals. Dry-run issues no PostgreSQL writes. Re-running the real migration is safe and should report every unchanged row as skipped.

## Seeding

Seeding is explicit and is never run by install, build, migrations, middleware, or application startup:

```bash
npm run db:seed
```

The seed only creates missing defaults. Existing users, categories, projects, homepage hero, and about/contact/footer settings are never updated or overwritten, so admin-edited content remains authoritative. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` before the first production seed; do not use the example credentials in production.

## Cloudflare R2

R2 upload behavior is unchanged. Configure authenticated S3 access separately from the public asset URL:

```dotenv
CLOUDFLARE_R2_ACCOUNT_ID="your_account_id"
CLOUDFLARE_R2_ACCESS_KEY_ID="your_access_key"
CLOUDFLARE_R2_SECRET_ACCESS_KEY="your_secret_key"
CLOUDFLARE_R2_BUCKET_NAME="your_bucket"
CLOUDFLARE_R2_ENDPOINT="https://your-account-id.r2.cloudflarestorage.com"
CLOUDFLARE_R2_PUBLIC_URL="https://cdn.example.com"
NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_URL="https://cdn.example.com"
```

`CLOUDFLARE_R2_ENDPOINT` is used for authenticated operations. Browser-facing URLs and database values use `CLOUDFLARE_R2_PUBLIC_URL`. Legacy `/api/uploads` seed assets remain readable, while new admin uploads go to R2.

To change only an existing R2 public URL base in PostgreSQL, set `DATABASE_URL`, `DIRECT_URL`, `OLD_R2_PUBLIC_URL`, and `NEW_R2_PUBLIC_URL`. Review the read-only plan before running the transactional update:

```bash
npm run migrate:r2-public-url:dry-run
npm run migrate:r2-public-url
```

The migration scans only schema-defined media URL fields, preserves every character after the old base, and never calls the R2 API.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Generate the SQLite client and start local Next.js |
| `npm run dev:sqlite` | Explicit SQLite development mode |
| `npm run dev:pg` | Generate the PostgreSQL client and test locally against Neon |
| `npm run build` | Generate the matching Prisma Client and make a production build |
| `npm run build:pg` | Force a PostgreSQL client and production build |
| `npm run migrate:r2-public-url:dry-run` | Preview the database-only R2 public URL replacement |
| `npm run migrate:r2-public-url` | Transactionally replace and verify the R2 public URL base |
| `npm run prisma:generate` | Generate Prisma Client for the configured `DATABASE_URL` |
| `npm run prisma:generate:local` | Generate Prisma Client explicitly for local SQLite |
| `npm run prisma:generate:sqlite` | Generate Prisma Client explicitly for SQLite |
| `npm run prisma:generate:postgres` | Generate Prisma Client explicitly for PostgreSQL |
| `npm run prisma:migrate:dev -- --name <name>` | Create/apply local SQLite development migrations |
| `npm run prisma:migrate:deploy` | Apply checked-in PostgreSQL migrations in production |
| `npm run migrate:data:pg:dry-run` | Read-only SQLite-to-PostgreSQL migration plan |
| `npm run migrate:data:pg` | Atomically copy SQLite records to PostgreSQL and verify them |
| `npm run db:push` | Sync the local SQLite schema without migration history |
| `npm run db:seed` | Insert missing defaults without updating existing records |
| `npm run db:studio` | Open Prisma Studio for the configured database |

Open [http://localhost:3000](http://localhost:3000) for the site and [http://localhost:3000/admin/login](http://localhost:3000/admin/login) for the admin panel.
