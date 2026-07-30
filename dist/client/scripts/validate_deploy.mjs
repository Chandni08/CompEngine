import { spawnSync } from "node:child_process";

const validators = [
  "validate_heading_consistency.mjs",
  "validate_customer_voice_sources.mjs",
  "validate_product_launch_press_releases.mjs",
  "validate_historical_product_catalog.mjs",
  "validate_historical_waters_catalog.mjs",
];

for (const validator of validators) {
  const result = spawnSync(process.execPath, [`scripts/${validator}`], {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
