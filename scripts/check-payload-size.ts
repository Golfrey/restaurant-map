import { supportedCities } from "../shared/cities";
import { getConfig } from "../server/config";
import { loadRestaurants } from "../server/repository";

const vercelFunctionPayloadLimitBytes = 4.5 * 1024 * 1024;
const warningThresholdBytes = 4 * 1024 * 1024;
const refresh = process.argv.includes("--refresh");
let failed = false;

for (const city of supportedCities) {
  const payload = await loadRestaurants(getConfig(city.code), { refresh });
  const bytes = Buffer.byteLength(JSON.stringify({ ...payload, cached: true }));
  const mb = (bytes / 1024 / 1024).toFixed(2);

  console.log(`${city.code}: ${mb} MB (${payload.restaurants.length.toLocaleString()} restaurants)`);

  if (bytes >= vercelFunctionPayloadLimitBytes) {
    failed = true;
    console.error(`${city.code} exceeds Vercel's 4.5 MB function response limit.`);
  } else if (bytes >= warningThresholdBytes) {
    console.warn(`${city.code} is close to Vercel's 4.5 MB function response limit.`);
  }
}

if (failed) {
  process.exitCode = 1;
}
