import { parentPort } from "node:worker_threads";

parentPort.on("message", ({ chunk, startOffset }) => {
  const stats = {
    total: 0,
    levels: { INFO: 0, WARN: 0, ERROR: 0, DEBUG: 0 },
    status: { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 },
    pathCounts: new Map(),
    responseTimeSum: 0,
  };

  const lines = chunk.split("\n");

  for (const line of lines) {
    if (!line.trim()) continue;

    const parts = line.split(" ");
    if (parts.length < 7) continue;

    const [, /*ts*/ level /*service*/, , status, timeMs, method, ...pathParts] =
      parts;
    const path = pathParts.join(" ");

    stats.total++;

    // level
    if (stats.levels[level] !== undefined) {
      stats.levels[level]++;
    }

    // status class
    const code = Number(status);
    if (!isNaN(code)) {
      const cls = Math.floor(code / 100) + "xx";
      if (stats.status[cls] !== undefined) {
        stats.status[cls]++;
      }
    }

    stats.pathCounts.set(path, (stats.pathCounts.get(path) || 0) + 1);

    const ms = Number(timeMs);
    if (!isNaN(ms)) {
      stats.responseTimeSum += ms;
    }
  }

  parentPort.postMessage(stats);
});
