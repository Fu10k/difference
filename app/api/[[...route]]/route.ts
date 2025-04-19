import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis/cloudflare"
import { Context, Env, Hono } from "hono"
import { env } from "hono/adapter"
import { cors } from "hono/cors"
import { BlankInput } from "hono/types"
import { handle } from "hono/vercel"
import { PrismaClient } from "@prisma/client/edge"
import { withAccelerate } from "@prisma/extension-accelerate"

declare module 'hono' {
  interface ContextVariableMap {
    ratelimit: Ratelimit
  }
}

export const runtime = 'edge'

const app = new Hono().basePath('/api')

const cache = new Map()

type EnvConfig = {
  UPSTASH_REDIS_REST_TOKEN: string
  UPSTASH_REDIS_REST_URL: string
  DATABASE_URL: string
}

const getRedisClient = (c: Context<Env, '/search', BlankInput>) => {
  const { UPSTASH_REDIS_REST_TOKEN, UPSTASH_REDIS_REST_URL } = env<EnvConfig>(c)
  return new Redis({
    token: UPSTASH_REDIS_REST_TOKEN,
    url: UPSTASH_REDIS_REST_URL,
  })
}

const getPostgresClient = (c: Context<Env, '/search', BlankInput>) => {
  const { DATABASE_URL } = env<EnvConfig>(c)
  return new PrismaClient({
    datasources: {
      db: {
        url: DATABASE_URL
      }
    }
  }).$extends(withAccelerate())
}

class RedisRateLimiter {
  private static instance: Ratelimit
  private static redis: Redis

  static getInstance(c: Context<Env, '/search', BlankInput>): Ratelimit {
    if(!this.redis) {
      this.redis = getRedisClient(c)        
    } 

    if(!this.instance) {
      this.instance = new Ratelimit({
        redis: this.redis,
        limiter: Ratelimit.slidingWindow(200, '50 s'),
        ephemeralCache: cache,
        analytics: true,
      })
    }

    return this.instance
  }
}

app.use('/*', cors())

app.use(async (c, next) => {
  const ratelimit = RedisRateLimiter.getInstance(c)
  c.set('ratelimit', ratelimit)
  await next()
})

app.get('/search', async (c) => {
  try {
    const ratelimit = c.get('ratelimit')

    const ip = c.req.raw.headers.get('x-forwarded-for') || c.req.header('x-real-ip') || "anonymous"

    const { success } = await ratelimit.limit(ip)

    if(success) {
      const start = performance.now()
    
      const query = c.req.query('q')?.trim().toUpperCase()
      const database = c.req.query('engine')?.trim().toLowerCase() || 'redis'

      if(!query || query.length === 0) {
        return c.json({ message: 'Invalid search query' }, { status: 400 })
      }

      let results: string[] = []

      switch(database) {
        case 'redis':
          results = await searchRedis(c, query)
          break
        case 'postgresql':
          results = await searchPostgres(c, query)
          break
        default:
          return c.json({ message: 'Unsupported Database' }, { status: 400 })
      }
    
      const end = performance.now()
    
      return c.json({
        results,
        duration: end - start,
      })
    } else {
      return c.json({ message: 'Rate limit exceeded' }, { status: 429 })
    }
  } catch (err) {
    console.error(err)
    return c.json({ results: [], message: 'Something went wrong' }, { status: 500 })
  }
})

async function searchRedis(c: Context, query: string): Promise<string[]> {
  const redis = getRedisClient(c) 
  const res = []
  const rank = await redis.zrank("terms", query)

  if(rank !== null && rank !== undefined) {
    const temp = await redis.zrange<string[]>("terms", rank, rank + 80)

    for (const el of temp) {
      if(!el.startsWith(query)) {
        break
      }

      if(el.endsWith('*')) {
        res.push(el.substring(0, el.length - 1))
      }
    }
  }
  return res
}

async function searchPostgres(c: Context, query: string): Promise<string[]> {
  const prisma = getPostgresClient(c)
  try {
    const results = await prisma.term.findMany({
      where: {
        member: {
          startsWith: query,
        },
        isComplete: true,
      },
      select: {
        member: true,
      },
      take: 80,
      cacheStrategy: { ttl: 60 }
    })

    return results.map(result => result.member.endsWith('*') ? result.member.substring(0, result.member.length - 1) : result.member)
  } finally {
    await prisma.$disconnect()
  }
}

export const GET = handle(app)
export default app as never
