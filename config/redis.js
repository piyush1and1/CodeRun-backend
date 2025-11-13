import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on('error', (err) => console.error('❌ Redis error:', err));
redisClient.on('connect', () => console.log('✅ Connected to Redis'));

await redisClient.connect();

export default redisClient;
