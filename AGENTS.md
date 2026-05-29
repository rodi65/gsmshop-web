# CEPLOG Codex Working Rules

## Project Identity

- The project name is CEPLOG.
- Do not use old GSMSHOP naming in UI, labels, comments, or documentation unless explicitly asked for migration history.
- CEPLOG is a GSM shop management panel with Kasa, Stok, Satış, Teknik Servis, Cari and reporting logic.

## Critical Safety Rules

- Never push directly to main.
- Never merge to main.
- Never deploy to production.
- Always create a new feature branch for every task.
- Always open a pull request after changes.
- Wait for the Vercel Preview deployment.
- The user must review and approve the preview before merge.
- Do not edit .env files.
- Do not read, print, expose, or modify secrets.
- Do not use Supabase service_role keys.
- Do not modify production database data.
- Do not run destructive database commands.
- Do not delete financial records.
- For database migrations, ask for explicit user approval first.

## Financial Data Rules

- Financial records must not be hard-deleted.
- Use archive, soft delete, reversal transaction, or audit-safe correction logic.
- Kasa, stok, satış, cari and teknik servis totals must remain consistent.
- Do not bypass validation rules.
- Do not allow cash payments above available cash.
- Do not allow collections above remaining balance.
- Do not allow refunds above paid amount.

## UI Rules

- Keep the main dashboard layout stable unless the user explicitly asks to change it.
- Keep sidebar compact and responsive.
- Do not break existing Kasa, Telefon, Aksesuar, Diğerleri, Sorgula, Stok, Teknik Servis, Kara Defter, Yönetim navigation.
- Prefer minimal targeted changes over broad rewrites.
- Do not redesign unrelated screens.

## Workflow

1. Create a branch named feature/short-task-name.
2. Make only the requested changes.
3. Run lint/build/test if available.
4. Commit changes with a clear message.
5. Open a pull request.
6. Report changed files and test result.
7. Do not merge.
8. Do not promote to production.
