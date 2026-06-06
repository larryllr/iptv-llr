export type Env = {
  CHANNELS: KVNamespace;
  ADMIN_PASSWORD: string;
  UPSTREAM_URL?: string;
  UPSTREAM_URLS?: string;
  ASSETS?: Fetcher;
};
