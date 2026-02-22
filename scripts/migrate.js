// Runs all SQL migration files against the database.
// Called automatically during build: node scripts/migrate.js
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is not set')
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function migrate() {
  const migrationsDir = path.join(__dirname, '..', 'migrations')
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()

  console.log(`Running ${files.length} migration(s)...`)

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    console.log(`Applying ${file}...`)
    await pool.query(sql)
  }

  console.log('Migrations completed!')
  await pool.end()
}

migrate().catch(err => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
