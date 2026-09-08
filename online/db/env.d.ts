declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    AI_BASE_URL?: string;
    AI_MODEL?: string;
    AI_API_KEY?: string;
  }
}
