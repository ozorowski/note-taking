# Local Development Setup

## Prerequisites

You need Postgres installed locally. Here are quick setup options:

### Option A: Using Homebrew (macOS)
```bash
brew install postgresql@15
brew services start postgresql@15

# Verify installation
psql --version
```

### Option B: Using Docker (Any OS)
```bash
docker run --name notetaking-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=notetaking \
  -p 5432:5432 \
  -d postgres:15
```

### Option C: Windows/Manual
Download from https://www.postgresql.org/download/windows/

---

## Step 1: Create Database

If using Homebrew:
```bash
createdb notetaking
```

If using Docker, the database is already created.

## Step 2: Verify Connection

Update `.env.local` if needed (it should have the correct defaults):
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/notetaking
JWT_SECRET=dev-secret-key-change-in-production
OPENAI_API_KEY=
```

Test the connection:
```bash
psql postgresql://postgres:postgres@localhost:5432/notetaking -c "SELECT 1"
```

You should see:
```
 ?column?
----------
        1
(1 row)
```

## Step 3: Run Migrations

```bash
bash scripts/migrate.sh
```

You should see:
```
Running migrations...
Applying migrations/001_init_schema.sql...
Migrations completed!
```

## Step 4: Start the Dev Server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

---

## You Should See:
- Redirect to login page
- Login form with email/password
- Link to sign up

## Test Flow:
1. Click "Sign up"
2. Create account with email/password
3. Dashboard with "Your Boards" (empty)
4. "New Board" button

---

## Troubleshooting

### "DATABASE_URL environment variable is not set"
- Check `.env.local` exists in project root
- Make sure `DATABASE_URL` line is uncommented

### "psql: command not found"
- Run `brew install postgresql@15` again
- Or use Docker instead

### "Connection refused"
- Is Postgres running? Check with `brew services list`
- Try `brew services start postgresql@15`

### Migrations fail
- Make sure database exists: `psql -l`
- Try manually: `psql $DATABASE_URL -f migrations/001_init_schema.sql`
