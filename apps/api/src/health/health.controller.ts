import { Controller, Get } from "@nestjs/common";

/**
 * Liveness, not readiness.
 *
 * This endpoint answers one question — "is this process alive?" — and
 * deliberately touches nothing else. A health check that queries the database
 * turns a brief outage of a dependency into a restart loop of a process that
 * restarting cannot fix. Readiness, which is allowed to check dependencies,
 * arrives when there is something worth checking.
 */
@Controller("health")
export class HealthController {
  @Get()
  check(): { status: "ok"; uptimeSeconds: number } {
    return { status: "ok", uptimeSeconds: Math.round(process.uptime()) };
  }
}
