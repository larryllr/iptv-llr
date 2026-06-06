import { channelOverrideSchema, channelSchema, type Channel, type ChannelOverride } from "@iptv/contracts";
import { Hono } from "hono";
import type { Env } from "./env";
import { mergeChannels } from "./domain/merge-channels";
import { parsePlaylist } from "./domain/parse-playlist";

const SNAPSHOT = "channels:snapshot";
const CUSTOM = "channels:custom";
const OVERRIDES = "channels:overrides";
const DISABLED = "channels:disabled";
const REVISION = "channels:revision";
const SESSION_PREFIX = "session:";
const HEALTH = "channels:health";

async function readJson<T>(kv: KVNamespace, key: string, fallback: T): Promise<T> {
  return (await kv.get<T>(key, "json")) ?? fallback;
}

async function digest(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function streamSignature(url: string, env: Env) {
  return digest(`${url}\n${env.ADMIN_PASSWORD}`);
}

async function proxyStream(url: string, signature: string, env: Env) {
  if (signature !== await streamSignature(url, env)) return new Response("Invalid stream signature", { status: 403 });
  const upstream = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "Mozilla/5.0 IPTV-LLR/1.0", accept: "*/*" }
  });
  if (!upstream.ok) return new Response(`Upstream ${upstream.status}`, { status: 502 });
  const type = upstream.headers.get("content-type") ?? "";
  const isPlaylist = type.includes("mpegurl") || /\.m3u8(?:$|\?)/i.test(upstream.url);
  const headers = new Headers({
    "access-control-allow-origin": "*",
    "cache-control": isPlaylist ? "no-store" : "public, max-age=30",
    "content-type": type || (isPlaylist ? "application/vnd.apple.mpegurl" : "application/octet-stream")
  });
  if (!isPlaylist) return new Response(upstream.body, { headers });
  const text = await upstream.text();
  const lines = await Promise.all(text.split(/\r?\n/).map(async (line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    const absolute = new URL(trimmed, upstream.url).toString();
    const sig = await streamSignature(absolute, env);
    return `/api/v1/stream-segment?url=${encodeURIComponent(absolute)}&sig=${sig}`;
  }));
  return new Response(lines.join("\n"), { headers });
}

async function authorized(request: Request, env: Env) {
  const token = /(?:^|;\s*)iptv_session=([^;]+)/.exec(request.headers.get("cookie") ?? "")?.[1];
  if (!token) return false;
  return (await env.CHANNELS.get(`${SESSION_PREFIX}${await digest(token)}`)) !== null;
}

async function effective(env: Env) {
  const [upstream, custom, overrides, disabled] = await Promise.all([
    readJson<Channel[]>(env.CHANNELS, SNAPSHOT, []),
    readJson<Channel[]>(env.CHANNELS, CUSTOM, []),
    readJson<Record<string, ChannelOverride>>(env.CHANNELS, OVERRIDES, {}),
    readJson<string[]>(env.CHANNELS, DISABLED, [])
  ]);
  return mergeChannels(upstream, overrides, new Set(disabled), custom);
}

export async function performSync(env: Env) {
  const urls = env.UPSTREAM_URLS?.split(/\s+/).filter(Boolean) ?? [
    env.UPSTREAM_URL ?? "https://raw.githubusercontent.com/Guovin/iptv-api/gd/output/result.m3u"
  ];
  try {
    const results = await Promise.allSettled(urls.map(async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${url} 返回 ${response.status}`);
      return parsePlaylist(await response.text());
    }));
    const merged = new Map<string, Channel>();
    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      for (const channel of result.value) {
        const existing = merged.get(channel.id);
        if (!existing) {
          merged.set(channel.id, channel);
          continue;
        }
        const urls = new Set(existing.sources.map((source) => source.url));
        for (const source of channel.sources) {
          if (!urls.has(source.url)) existing.sources.push(source);
        }
      }
    }
    const channels = Array.from(merged.values());
    if (!channels.length) throw new Error("同步结果为空");
    const revision = Date.now().toString();
    await Promise.all([
      env.CHANNELS.put(SNAPSHOT, JSON.stringify(channels)),
      env.CHANNELS.put(REVISION, revision),
      env.CHANNELS.delete(HEALTH),
      env.CHANNELS.put("sync:status", JSON.stringify({
        state: "success", updatedAt: new Date().toISOString(), channelCount: channels.length
      }))
    ]);
    return { ok: true, revision, channelCount: channels.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "同步失败";
    await env.CHANNELS.put("sync:status", JSON.stringify({
      state: "error", updatedAt: new Date().toISOString(), channelCount: 0, message
    }));
    throw new Error(message);
  }
}

export const app = new Hono<{ Bindings: Env }>();

app.get("/api/v1/revision", async (c) =>
  c.json({ revision: (await c.env.CHANNELS.get(REVISION)) ?? "0" })
);

app.get("/api/v1/channels", async (c) => {
  const revision = (await c.env.CHANNELS.get(REVISION)) ?? "0";
  if (c.req.header("if-none-match") === `"${revision}"`) return c.body(null, 304);
  c.header("etag", `"${revision}"`);
  c.header("cache-control", "public, max-age=60");
  const health = await readJson<Record<string, { failures: number; lastFailure?: string; lastSuccess?: string }>>(
    c.env.CHANNELS, HEALTH, {}
  );
  const channels = await effective(c.env);
  const filtered = await Promise.all(channels.map(async (channel) => ({
    ...channel,
    sources: (await Promise.all(channel.sources.map(async (source) => ({
      source,
      record: health[await digest(source.url)]
    })))).filter(({ record }) => !record || record.failures < 3).map(({ source }) => source)
  })));
  return c.json({
    revision,
    generatedAt: new Date().toISOString(),
    channels: filtered.filter((channel) => channel.sources.length > 0)
  });
});

app.post("/api/v1/health", async (c) => {
  const body = await c.req.json<{ url?: string; ok?: boolean }>();
  if (!body.url || typeof body.ok !== "boolean" || body.url.length > 4096) {
    return c.json({ error: "Invalid health report" }, 400);
  }
  const key = await digest(body.url);
  const health = await readJson<Record<string, { failures: number; lastFailure?: string; lastSuccess?: string }>>(
    c.env.CHANNELS, HEALTH, {}
  );
  const current = health[key] ?? { failures: 0 };
  health[key] = body.ok
    ? { failures: 0, lastSuccess: new Date().toISOString() }
    : { ...current, failures: Math.min(current.failures + 1, 10), lastFailure: new Date().toISOString() };
  await c.env.CHANNELS.put(HEALTH, JSON.stringify(health));
  return c.json({ ok: true });
});

app.get("/api/v1/stream/:channel/:source", async (c) => {
  const channels = await effective(c.env);
  const channel = channels.find((item) => item.id === c.req.param("channel"));
  const source = channel?.sources[Number(c.req.param("source"))];
  if (!source || !["http", "https"].includes(source.protocol)) return c.text("Source unavailable", 404);
  return proxyStream(source.url, await streamSignature(source.url, c.env), c.env);
});

app.get("/api/v1/stream-segment", async (c) => {
  const url = c.req.query("url");
  const signature = c.req.query("sig");
  if (!url || !signature) return c.text("Missing stream parameters", 400);
  return proxyStream(url, signature, c.env);
});

app.post("/api/admin/login", async (c) => {
  const body = await c.req.json<{ password?: string }>();
  if (!body.password || (await digest(body.password)) !== (await digest(c.env.ADMIN_PASSWORD))) {
    return c.json({ error: "密码错误" }, 401);
  }
  const token = crypto.randomUUID() + crypto.randomUUID();
  await c.env.CHANNELS.put(`${SESSION_PREFIX}${await digest(token)}`, "1", { expirationTtl: 43200 });
  c.header("set-cookie", `iptv_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`);
  return c.json({ ok: true });
});

app.post("/api/admin/logout", async (c) => {
  const token = /(?:^|;\s*)iptv_session=([^;]+)/.exec(c.req.header("cookie") ?? "")?.[1];
  if (token) await c.env.CHANNELS.delete(`${SESSION_PREFIX}${await digest(token)}`);
  c.header("set-cookie", "iptv_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
  return c.json({ ok: true });
});

app.use("/api/admin/*", async (c, next) => {
  if (!(await authorized(c.req.raw, c.env))) return c.json({ error: "请先登录" }, 401);
  await next();
});

app.get("/api/admin/state", async (c) => {
  const [channels, custom, overrides, disabled, sync] = await Promise.all([
    effective(c.env),
    readJson<Channel[]>(c.env.CHANNELS, CUSTOM, []),
    readJson<Record<string, ChannelOverride>>(c.env.CHANNELS, OVERRIDES, {}),
    readJson<string[]>(c.env.CHANNELS, DISABLED, []),
    readJson(c.env.CHANNELS, "sync:status", { state: "never", updatedAt: null, channelCount: 0 })
  ]);
  return c.json({ channels, custom, overrides, disabled, sync });
});

app.post("/api/admin/sync", async (c) => {
  try {
    return c.json(await performSync(c.env));
  } catch (error) {
    const message = error instanceof Error ? error.message : "同步失败";
    return c.json({ error: message }, 502);
  }
});

app.put("/api/admin/custom/:id", async (c) => {
  const parsed = channelSchema.safeParse(await c.req.json());
  if (!parsed.success || parsed.data.id !== c.req.param("id")) return c.json({ error: "频道数据无效" }, 400);
  const items = await readJson<Channel[]>(c.env.CHANNELS, CUSTOM, []);
  const next = [...items.filter((item) => item.id !== parsed.data.id), parsed.data];
  await c.env.CHANNELS.put(CUSTOM, JSON.stringify(next));
  await c.env.CHANNELS.put(REVISION, Date.now().toString());
  return c.json({ ok: true });
});

app.put("/api/admin/override/:id", async (c) => {
  const parsed = channelOverrideSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "覆盖数据无效" }, 400);
  const items = await readJson<Record<string, ChannelOverride>>(c.env.CHANNELS, OVERRIDES, {});
  items[c.req.param("id")] = parsed.data;
  await c.env.CHANNELS.put(OVERRIDES, JSON.stringify(items));
  await c.env.CHANNELS.put(REVISION, Date.now().toString());
  return c.json({ ok: true });
});

app.delete("/api/admin/custom/:id", async (c) => {
  const items = await readJson<Channel[]>(c.env.CHANNELS, CUSTOM, []);
  await c.env.CHANNELS.put(CUSTOM, JSON.stringify(items.filter((item) => item.id !== c.req.param("id"))));
  await c.env.CHANNELS.put(REVISION, Date.now().toString());
  return c.json({ ok: true });
});

app.all("*", async (c) => c.env.ASSETS ? c.env.ASSETS.fetch(c.req.raw) : c.text("IPTV LLR API"));

export default app;
