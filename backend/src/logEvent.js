import { Event } from "./models/Event.js";
import { DiscordDepthChartTeamStat } from "./models/DiscordDepthChartTeamStat.js";

const DISCORD_DEPTH_CHART_EVENT = "discord_depth_chart";

export async function logEvent(type, data = {}) {
  try {
    await Event.create({ type, data });
  } catch {
    // never crash the request over analytics
  }
}

/**
 * Track Discord /depth-chart invocations: raw Event row + rolling per-team counts.
 * Safe to await without try/catch at call sites; failures are swallowed.
 */
export async function recordDiscordDepthChartUsage(payload) {
  const { teamInput, teamCanonical = null, ok, guildId = null, userId = null } = payload;
  try {
    await Event.create({
      type: DISCORD_DEPTH_CHART_EVENT,
      data: { teamInput, teamCanonical, ok, guildId, userId },
    });
  } catch {
    // ignore
  }
  if (!ok || !teamCanonical) return;
  try {
    await DiscordDepthChartTeamStat.findOneAndUpdate(
      { teamCanonical },
      { $inc: { count: 1 }, $set: { lastRequestedAt: new Date() } },
      { upsert: true }
    );
  } catch {
    // ignore
  }
}