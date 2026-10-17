import { it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import {
  campaignEndlessBlueprint,
  ENDLESS_CAMPAIGN_TEMPLATES,
} from "../../src/gravity/campaign-endless";
import {
  validCampaignSolution,
  authorCampaignSolution,
} from "./campaign-authoring-utils";
import type { WitnessShot } from "../../src/gravity/types";
it.skipIf(process.env.GRAVITY_AUTHOR_ENDLESS_CAMPAIGN !== "1")(
  "records robust solutions for every campaign endless difficulty band",
  () => {
    const file = "src/gravity/campaign-endless-witnesses.json";
    const output = JSON.parse(readFileSync(file, "utf8")) as Record<
      string,
      WitnessShot[]
    >;
    const failures: string[] = [];
    for (const template of ENDLESS_CAMPAIGN_TEMPLATES)
      for (let band = 0; band < 3; band++) {
        const level = campaignEndlessBlueprint(template, band),
          key = `${template}:${band}`;
        if (output[key] && validCampaignSolution(level, output[key])) {
          console.log("retained", template + 1, band);
          continue;
        }
        try {
          const earlier = output[`${template}:${Math.max(0, band - 1)}`];
          output[key] =
            earlier && validCampaignSolution(level, earlier)
              ? structuredClone(earlier)
              : authorCampaignSolution(level);
        } catch (error) {
          failures.push(`${template + 1}/${band}: ${error}`);
          console.log("failed", template + 1, band);
          continue;
        }
        writeFileSync(file, JSON.stringify(output, null, 2) + "\n");
        console.log("authored", template + 1, band);
      }
    if (failures.length) throw new Error(failures.join("\n"));
  },
  900000,
);
