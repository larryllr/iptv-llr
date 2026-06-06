import { channelSchema, sourceLineSchema, type Channel } from "@iptv/contracts";
import { stableId } from "./stable-id";

type PendingMetadata = {
  name: string;
  category: string;
  logo?: string;
};

function parseExtInf(line: string): PendingMetadata | null {
  const comma = line.lastIndexOf(",");
  if (comma < 0) return null;
  const attributes = line.slice(0, comma);
  const value = (name: string) =>
    new RegExp(`${name}="([^"]*)"`, "i").exec(attributes)?.[1]?.trim();
  const name = line.slice(comma + 1).trim();
  if (!name) return null;
  return {
    name,
    category: value("group-title") || "其他",
    logo: value("tvg-logo") || undefined
  };
}

export async function parsePlaylist(input: string): Promise<Channel[]> {
  const grouped = new Map<string, Omit<Channel, "id" | "sources"> & { urls: string[] }>();
  let pending: PendingMetadata | null = null;
  const now = new Date().toISOString();

  for (const raw of input.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line === "#EXTM3U") continue;
    if (line.startsWith("#EXTINF:")) {
      pending = parseExtInf(line);
      continue;
    }

    let metadata = pending;
    let url = line;
    pending = null;
    if (!metadata) {
      const comma = line.indexOf(",");
      if (comma < 1) continue;
      metadata = { name: line.slice(0, comma).trim(), category: "其他" };
      url = line.slice(comma + 1).trim();
    }

    if (metadata.category.includes("更新时间") || /^\d{4}-\d{2}-\d{2}\s/.test(metadata.name)) continue;
    const parsedSource = sourceLineSchema.safeParse({ url });
    if (!metadata.name || !parsedSource.success) continue;
    const key = metadata.name.toLocaleLowerCase();
    const existing = grouped.get(key);
    if (existing) {
      if (!existing.urls.includes(url)) existing.urls.push(url);
      continue;
    }
    grouped.set(key, {
      name: metadata.name,
      aliases: [],
      category: metadata.category,
      ...(metadata.logo ? { logo: metadata.logo } : {}),
      origin: "upstream",
      enabled: true,
      order: grouped.size,
      updatedAt: now,
      urls: [url]
    });
  }

  return Promise.all(
    Array.from(grouped.values()).map(async ({ urls, ...channel }) =>
      channelSchema.parse({
        ...channel,
        id: await stableId(channel.name),
        sources: urls.map((url) => ({ url }))
      })
    )
  );
}
