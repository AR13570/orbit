import { it } from "vitest";
import { writeFileSync, readFileSync } from "node:fs";
import { campaignBlueprint } from "../../src/gravity/campaign-design";
import { witnessCompletionTime } from "../../src/gravity/generator";
import type { WitnessShot } from "../../src/gravity/types";
import {
  validCampaignSolution,
  authorCampaignSolution,
} from "./campaign-authoring-utils";
it.skipIf(process.env.GRAVITY_AUTHOR_CAMPAIGN !== "1")(
  "records physically reachable solutions for the rebuilt campaign",
  () => {
    let output: Record<string, WitnessShot[]> = {};
    try {
      output = JSON.parse(
        readFileSync("src/gravity/campaign-witnesses.json", "utf8"),
      );
    } catch {}
    for (let index = 0; index < 45; index++) {
      const level = campaignBlueprint(index);
      if (output[index] && validCampaignSolution(level, output[index])) {
        console.log("retained", index + 1);
        continue;
      }
      const shots = authorCampaignSolution(level);
      const seconds = witnessCompletionTime({ ...level, witness: shots })!;
      if (witnessCompletionTime({ ...level, witness: shots }, 1 / 240) === null)
        throw new Error(`Half step invalid ${index + 1}`);
      output[index] = shots;
      writeFileSync(
        "src/gravity/campaign-witnesses.json",
        JSON.stringify(output, null, 2) + "\n",
      );
      console.log(
        "authored",
        index + 1,
        level.title,
        seconds.toFixed(2),
        "seconds",
        shots.length,
        "shots",
      );
    }
  },
  600000,
);
