import fs from "node:fs/promises";
import { Worker } from "node:worker_threads";
import os from "node:os";
import { pipeline } from "node:stream/promises";
import { createReadStream } from "node:fs";

const NUM_WORKERS = os.cpus().length;

export async function computeLogStats({ flags }, resolvePath) {
  const input = flags.input;
  const output = flags.output;
  if (!input || !output) {
    console.log("Invalid input: --input and --output required");
    return false;
  }

  const inPath = resolvePath(input);
  const outPath = resolvePath(output);

  try {
    const stat = await fs.stat(inPath);
    if (!stat.isFile()) throw new Error("not a file");

    const fileSize = stat.size;
    const chunkSize = Math.ceil(fileSize / NUM_WORKERS);

    const workers = [];
    const promises = [];

    let start = 0;
    for (let i = 0; i < NUM_WORKERS; i++) {
      const end = Math.min(start + chunkSize, fileSize);

      const worker = new Worker(
        new URL("../workers/logWorker.js", import.meta.url),
      );
      workers.push(worker);

      const p = new Promise((resolve, reject) => {
        worker.on("message", resolve);
        worker.on("error", reject);
        worker.on("exit", (code) => {
          if (code !== 0)
            reject(new Error(`Worker stopped with exit code ${code}`));
        });
      });
      promises.push(p);
      start = end;
    }

    let offset = 0;
    let workerIdx = 0;

    await pipeline(
      createReadStream(inPath, { highWaterMark: 1024 * 1024 }),
      new Transform({
        transform(chunk, enc, cb) {
          let data = chunk.toString();
          let lastNewline = data.lastIndexOf("\n");

          if (lastNewline === -1) {
            workers[workerIdx].postMessage({
              chunk: data,
              startOffset: offset,
            });
            offset += data.length;
          } else {
            const complete = data.substring(0, lastNewline + 1);
            const remaining = data.substring(lastNewline + 1);

            workers[workerIdx].postMessage({
              chunk: complete,
              startOffset: offset,
            });
            offset += complete.length;
            if (remaining) {
              workerIdx = (workerIdx + 1) % NUM_WORKERS;
              workers[workerIdx].postMessage({
                chunk: remaining,
                startOffset: offset,
              });
              offset += remaining.length;
            }
          }

          cb();
        },
        flush(cb) {
          cb();
        },
      }),
    );

    for (const w of workers) w.postMessage("done");

    const results = await Promise.all(promises);

    const final = {
      total: 0,
      levels: { INFO: 0, WARN: 0, ERROR: 0, DEBUG: 0 },
      status: { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 },
      pathCounts: new Map(),
      responseTimeSum: 0,
    };

    for (const r of results) {
      final.total += r.total;
      for (const lvl of Object.keys(r.levels)) {
        final.levels[lvl] = (final.levels[lvl] || 0) + r.levels[lvl];
      }
      for (const cls of Object.keys(r.status)) {
        final.status[cls] = (final.status[cls] || 0) + r.status[cls];
      }
      for (const [p, cnt] of r.pathCounts) {
        final.pathCounts.set(p, (final.pathCounts.get(p) || 0) + cnt);
      }
      final.responseTimeSum += r.responseTimeSum;
    }

    const topPaths = [...final.pathCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }));

    const avg =
      final.total > 0 ? (final.responseTimeSum / final.total).toFixed(2) : 0;

    const report = {
      total: final.total,
      levels: final.levels,
      status: final.status,
      topPaths,
      avgResponseTimeMs: Number(avg),
    };

    await fs.writeFile(outPath, JSON.stringify(report, null, 2));
    console.log(`Stats written to ${output}`);
    return true;
  } catch (err) {
    console.log("Operation failed:", err.message);
    return false;
  }
}
