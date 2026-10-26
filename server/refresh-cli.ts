// One-off pipeline run: `npm run refresh`. Useful for cron jobs or debugging rankings.
import "dotenv/config";
import { refresh } from "./pipeline";

const snapshot = await refresh();
const items = snapshot.frontPage.map((item, i) => {
  const story = snapshot.countries[item.country]?.stories.find((s) => s.id === item.storyId);
  return `${String(i + 1).padStart(2)}. [${item.country}] ${story?.importance ?? "?"}  ${story?.headline}`;
});
console.log(`\nFront page (${snapshot.mode}):\n${items.join("\n")}`);
