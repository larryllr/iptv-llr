import { z } from "zod";
import { channelSchema } from "./channel";

export const syncStatusSchema = z.object({
  state: z.enum(["never", "syncing", "success", "error"]),
  updatedAt: z.string().datetime().nullable(),
  channelCount: z.number().int().nonnegative(),
  message: z.string().max(500).optional()
});

export const publicChannelResponseSchema = z.object({
  revision: z.string().min(1),
  generatedAt: z.string().datetime(),
  channels: z.array(channelSchema)
});

export type SyncStatus = z.infer<typeof syncStatusSchema>;
export type PublicChannelResponse = z.infer<typeof publicChannelResponseSchema>;

