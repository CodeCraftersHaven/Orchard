import { defineConfig } from 'prisma/config'
import { env } from '@orchard/config'

export default defineConfig({
  schema: './schema.prisma',
  datasource: {
    url: env.DATABASE_URL,
  },
})
