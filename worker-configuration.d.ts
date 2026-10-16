declare module 'cloudflare:workers' {
  export const env: {
    DB?: import('@cloudflare/workers-types').D1Database;
    BUCKET?: import('@cloudflare/workers-types').R2Bucket;
    ADMIN_USER_IDS?: string;
    ADMIN_SETUP_TOKEN_HASH?: string;
    ADMIN_SETUP_EXPIRES_AT?: string;
  };
}
