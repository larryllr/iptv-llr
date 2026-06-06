import type { Channel, ChannelOverride } from "@iptv/contracts";

export function mergeChannels(
  upstream: Channel[],
  overrides: Record<string, ChannelOverride>,
  disabled: Set<string>,
  custom: Channel[]
): Channel[] {
  const effective = upstream
    .filter((channel) => !disabled.has(channel.id))
    .map((channel) => {
      const override = overrides[channel.id];
      if (!override) return structuredClone(channel);
      return {
        ...structuredClone(channel),
        ...override,
        logo: override.logo === null ? undefined : override.logo ?? channel.logo,
        sources: override.sources
          ? structuredClone(override.sources)
          : structuredClone(channel.sources)
      };
    })
    .filter((channel) => channel.enabled);

  return [
    ...effective,
    ...custom.filter((channel) => channel.enabled).map((channel) => structuredClone(channel))
  ]
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}
