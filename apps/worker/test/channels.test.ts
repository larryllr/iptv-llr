import { describe, expect, it } from "vitest";
import { mergeChannels } from "../src/domain/merge-channels";
import { parsePlaylist } from "../src/domain/parse-playlist";

describe("playlist parsing", () => {
  it("parses M3U and aggregates duplicate channel sources", async () => {
    const channels = await parsePlaylist(`#EXTM3U
#EXTINF:-1 tvg-logo="https://example.com/c1.png" group-title="央视",CCTV-1
https://a.example/live.m3u8
#EXTINF:-1 group-title="央视",CCTV-1
rtsp://b.example/live
湖南卫视,http://hunan.example/live.m3u8`);

    expect(channels).toHaveLength(2);
    expect(channels[0].name).toBe("CCTV-1");
    expect(channels[0].sources).toHaveLength(2);
    expect(channels[1].category).toBe("其他");
  });

  it("ignores malformed and unsupported rows", async () => {
    const channels = await parsePlaylist("Bad,javascript:alert(1)\nNo URL");
    expect(channels).toEqual([]);
  });

  it("ignores playlist update-time metadata entries", async () => {
    const channels = await parsePlaylist(`#EXTM3U
#EXTINF:-1 group-title="🕘️更新时间",2026-05-16 11:37:47
https://example.com
#EXTINF:-1 group-title="央视",CCTV-1
https://example.com/live.m3u8`);
    expect(channels.map((channel) => channel.name)).toEqual(["CCTV-1"]);
  });
});

describe("channel merging", () => {
  it("applies overrides, disabled IDs, and custom channels without mutation", async () => {
    const upstream = await parsePlaylist("CCTV-1,https://example.com/c1.m3u8");
    const original = structuredClone(upstream);
    const custom = {
      ...upstream[0],
      id: "abcdefabcdefabcdefabcdef",
      name: "Local",
      origin: "custom" as const,
      order: -1
    };

    const result = mergeChannels(
      upstream,
      { [upstream[0].id]: { name: "央视一套", order: 10 } },
      new Set<string>(),
      [custom]
    );

    expect(result.map((item) => item.name)).toEqual(["Local", "央视一套"]);
    expect(upstream).toEqual(original);
  });
});
