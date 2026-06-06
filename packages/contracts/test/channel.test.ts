import { describe, expect, it } from "vitest";
import { channelSchema, sourceLineSchema } from "../src/index";

describe("channel contracts", () => {
  it("accepts a playable channel", () => {
    const result = channelSchema.parse({
      id: "1234567890abcdef12345678",
      name: "CCTV-1",
      category: "央视",
      sources: [{ url: "https://example.com/live.m3u8" }],
      origin: "upstream",
      enabled: true,
      order: 0,
      updatedAt: "2026-06-06T00:00:00.000Z"
    });

    expect(result.name).toBe("CCTV-1");
  });

  it("rejects channels without sources", () => {
    expect(() =>
      channelSchema.parse({
        id: "1234567890abcdef12345678",
        name: "Empty",
        category: "其他",
        sources: [],
        origin: "custom",
        enabled: true,
        order: 0,
        updatedAt: "2026-06-06T00:00:00.000Z"
      })
    ).toThrow();
  });

  it.each(["http", "https", "rtsp", "rtmp", "udp"])(
    "accepts the %s protocol",
    (protocol) => {
      expect(
        sourceLineSchema.parse({ url: `${protocol}://example.com/live` }).protocol
      ).toBe(protocol);
    }
  );

  it("rejects executable URL schemes", () => {
    expect(() => sourceLineSchema.parse({ url: "javascript:alert(1)" })).toThrow();
  });
});
