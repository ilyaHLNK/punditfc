import type { ImplementedMarket } from "@punditfc/contracts";

import type { MarketStrategy } from "../strategy.js";
import { exactScoreStrategy } from "./exact-score.js";
import { matchResultStrategy } from "./match-result.js";
import { totalGoalsStrategy } from "./total-goals.js";

/**
 * The single place a market is registered.
 *
 * `satisfies` is the guarantee ADR-0005 asks for: a market listed as
 * implemented but missing here fails the build, naming the missing key. The ADR
 * proposed an exhaustive `switch` with a `never` check for the same purpose,
 * which gives the identical guarantee but has to be edited for every new
 * market — the opposite of the registry the same document asks for. Adding a
 * market means adding its file and one line here.
 */
export const STRATEGY_BY_MARKET = {
  EXACT_SCORE: exactScoreStrategy,
  MATCH_RESULT: matchResultStrategy,
  TOTAL_GOALS: totalGoalsStrategy,
} satisfies Record<ImplementedMarket, MarketStrategy>;
