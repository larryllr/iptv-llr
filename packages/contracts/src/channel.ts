import { z } from "zod";

const allowedProtocols = ["http", "https", "rtsp", "rtmp", "udp"] as const;

export const sourceLineSchema = z
  .object({
    url: z.string().min(1).max(4096),
    label: z.string().max(80).optional(),
    quality: z.string().max(40).optional()
  })
  .transform((source, context) => {
    const match = /^([a-z][a-z0-9+.-]*):\/\//i.exec(source.url);
    const protocol = match?.[1]?.toLowerCase();
    if (!protocol || !allowedProtocols.includes(protocol as (typeof allowedProtocols)[number])) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Unsupported source protocol",
        path: ["url"]
      });
      return z.NEVER;
    }
    return { ...source, protocol };
  });

export const channelSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{24}$/),
  name: z.string().trim().min(1).max(160),
  aliases: z.array(z.string().trim().min(1).max(160)).default([]),
  category: z.string().trim().min(1).max(80),
  logo: z.string().url().max(4096).optional(),
  sources: z.array(sourceLineSchema).min(1),
  origin: z.enum(["upstream", "custom"]),
  enabled: z.boolean(),
  order: z.number().int(),
  updatedAt: z.string().datetime()
});

export const channelOverrideSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  logo: z.string().url().max(4096).nullable().optional(),
  sources: z.array(sourceLineSchema).min(1).optional(),
  enabled: z.boolean().optional(),
  order: z.number().int().optional()
});

export type SourceLine = z.infer<typeof sourceLineSchema>;
export type Channel = z.infer<typeof channelSchema>;
export type ChannelOverride = z.infer<typeof channelOverrideSchema>;

