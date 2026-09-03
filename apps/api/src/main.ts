import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";

const app = await NestFactory.create(AppModule);

// On SIGTERM the platform gives a process a few seconds before killing it.
// Shutdown hooks make Nest stop accepting connections and run each module's
// onModuleDestroy in that window, which is what lets a request in flight finish
// and a database connection close instead of being severed (docs/scope.md).
app.enableShutdownHooks();

await app.listen(3000);
