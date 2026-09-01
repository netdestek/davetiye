declare namespace Cloudflare {
  interface Env {
    FILES: R2Bucket;
    DAVETLY_ADMIN_EMAILS?: string;
    DAVETLY_ENABLE_DEMO?: string;
    CF_ACCESS_AUD?: string;
    CF_ACCESS_TEAM_DOMAIN?: string;
  }
}
