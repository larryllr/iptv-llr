import app from "./app";
import type { Env } from "./env";

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: Env) {
    await app.request("/api/admin/sync", {
      method: "POST",
      headers: { cookie: "scheduled=true" }
    }, env);
  }
};

