// my-nextjs-app/src/lib/redis.ts
// Hypothetical Redis client (mock implementation)

interface RedisCache {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, options?: { EX?: number }) => Promise<string | null>;
  // Add other Redis commands if needed
}

const mockStore: Record<string, string> = {};

export const redis: RedisCache = {
  get: async (key: string): Promise<string | null> => {
    console.log(`[Mock Redis] GET ${key}`);
    return mockStore[key] || null;
  },
  set: async (key: string, value: string, options?: { EX?: number }): Promise<string | null> => {
    console.log(`[Mock Redis] SET ${key}`, value, options || '');
    mockStore[key] = value;
    // Handle EX option (expiration) if necessary for mock behavior
    if (options?.EX) {
      setTimeout(() => {
        delete mockStore[key];
        console.log(`[Mock Redis] EXPIRED ${key}`);
      }, options.EX * 1000);
    }
    return 'OK';
  },
};

export default redis;
