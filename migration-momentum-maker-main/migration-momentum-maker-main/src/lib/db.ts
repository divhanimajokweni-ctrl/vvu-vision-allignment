import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const url = process.env.DATABASE_URL

  // If it's a libsql:// URL (Turso), use the libsql adapter
  if (url && url.startsWith('libsql://')) {
    const client = createClient({ url })
    const adapter = new PrismaLibSQL({ url, ...client })
    return new PrismaClient({ adapter, log: ['error', 'warn'] })
  }

  // Otherwise use the default SQLite driver (local dev)
  return new PrismaClient({ log: ['error', 'warn'] })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
