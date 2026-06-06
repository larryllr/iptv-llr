import app, { performSync } from "./app";
import type { Env } from "./env";

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: Env) {
    await performSync(env);
  }
};
