export type { ExactScoreSelection } from "./markets/exact-score.js";
export { exactScoreSelectionSchema } from "./markets/exact-score.js";
export type { ImplementedMarket, PredictionMarket } from "./markets/market.js";
export {
  IMPLEMENTED_MARKETS,
  implementedMarketSchema,
  PREDICTION_MARKETS,
  predictionMarketSchema,
} from "./markets/market.js";
export type { MatchResult, MatchResultSelection } from "./markets/match-result.js";
export {
  MATCH_RESULTS,
  matchResultSchema,
  matchResultSelectionSchema,
} from "./markets/match-result.js";
export type { PredictionInput, PredictionSelection, SelectionFor } from "./markets/registry.js";
export { predictionInputSchema, SELECTION_SCHEMA_BY_MARKET } from "./markets/registry.js";
export type { TotalGoalsDirection, TotalGoalsSelection } from "./markets/total-goals.js";
export {
  MAX_TOTAL_GOALS_LINE,
  MIN_TOTAL_GOALS_LINE,
  TOTAL_GOALS_DIRECTIONS,
  totalGoalsDirectionSchema,
  totalGoalsLineSchema,
  totalGoalsSelectionSchema,
} from "./markets/total-goals.js";
export type { MatchScore } from "./match/score.js";
export { goalCountSchema, matchScoreSchema, MAX_GOALS } from "./match/score.js";
