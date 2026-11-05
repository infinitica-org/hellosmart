# @hs/worker

The worker process is the same NestJS image as `apps/api`, started with `node dist/worker.js`.

- Health: `GET /api/v1/health` and `GET /api/v1/health/ready` on `WORKER_HEALTH_PORT` (default 4001).
- Queue: BullMQ on Redis, names `hs:{env}:ops`. Product jobs are not registered yet; a repeating `ping` job proves the process is alive.
- Tenant jobs must carry `orgId` and run inside `withOrg`.
