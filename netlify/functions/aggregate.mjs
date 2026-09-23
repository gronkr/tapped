// Every 5 minutes: rebuild totals + leaderboard for the current season.
import { getSeason, aggregate } from "../lib/data.mjs";

export default async () => {
  const s = await getSeason();
  if (s) await aggregate(s.id);
};
export const config = { schedule: "*/5 * * * *" };
