import { createClient, RedisClientType } from 'redis'
import { createHash } from 'crypto'

let redis: RedisClientType | null = null

async function getRedisClient(): Promise<RedisClientType> {
  if (redis && redis.isOpen) {
    return redis
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

  redis = createClient({
    url: redisUrl
  })

  redis.on('error', (err) => {
    console.error('Redis Client Error:', err)
  })

  redis.on('connect', () => {
    console.log('Redis Client Connected')
  })

  redis.on('disconnect', () => {
    console.log('Redis Client Disconnected')
  })

  await redis.connect()
  return redis
}

function generateCacheKey(endpoint: string, params: Record<string, any> = {}): string {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((result: Record<string, any>, key) => {
      result[key] = params[key]
      return result
    }, {})

  const keyData = `${endpoint}:${JSON.stringify(sortedParams)}`
  return createHash('sha256').update(keyData).digest('hex')
}

export async function getCachedData(endpoint: string, params?: Record<string, any>): Promise<any | null> {
  try {
    const client = await getRedisClient()
    const cacheKey = generateCacheKey(endpoint, params)

    const cachedData = await client.get(cacheKey)

    if (cachedData && typeof cachedData === 'string') {
      return JSON.parse(cachedData)
    }

    return null
  } catch (error) {
    console.error('Error getting cached data:', error)
    return null
  }
}

export async function setCachedData(
  endpoint: string,
  data: any,
  ttlSeconds: number = 3600, // 1 hour default
  params?: Record<string, any>
): Promise<void> {
  try {
    const client = await getRedisClient()
    const cacheKey = generateCacheKey(endpoint, params)

    await client.setEx(cacheKey, ttlSeconds, JSON.stringify(data))
  } catch (error) {
    console.error('Error setting cached data:', error)
  }
}

export async function deleteCachedData(endpoint: string, params?: Record<string, any>): Promise<void> {
  try {
    const client = await getRedisClient()
    const cacheKey = generateCacheKey(endpoint, params)

    await client.del(cacheKey)
  } catch (error) {
    console.error('Error deleting cached data:', error)
  }
}

export async function clearAllCache(): Promise<void> {
  try {
    const client = await getRedisClient()
    await client.flushAll()
  } catch (error) {
    console.error('Error clearing all cache:', error)
  }
}

// Graceful shutdown
export async function closeRedisConnection(): Promise<void> {
  if (redis && redis.isOpen) {
    await redis.disconnect()
    redis = null
  }
}

// Cache keys for TikTok API endpoints
export const CACHE_KEYS = {
  PROFILE_VIDEOS: 'tiktok:profile:videos',
  PROFILE_INFO: 'tiktok:profile:info',
  VIDEO_DETAILS: 'tiktok:video:details'
} as const

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  ONE_HOUR: 3600,
  FOUR_HOURS: 14400,
  ONE_DAY: 86400,
  ONE_WEEK: 604800
} as const