import { Module } from "@nestjs/common";

import { HealthModule } from "./health/health.module.js";

/**
 * The composition root: every feature module is registered here and nowhere
 * else, so the shape of the application is readable in one file.
 */
@Module({
  imports: [HealthModule],
})
export class AppModule {}
