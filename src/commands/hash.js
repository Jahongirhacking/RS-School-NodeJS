import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { pipeline } from "node:stream/promises";
import fs from "node:fs/promises";
import path from "node:path";

const SUPPORTED = new Set(["sha256", "md5", "sha512"]);

export async function calculateHash({ flags }, resolvePath) {
  const input = flags.input;
  if (!input) {
    console.log("Invalid input: --input is required");
    return false;
  }

  const algorithm = flags.algorithm || "sha256";
  if (!SUPPORTED.has(algorithm)) {
    console.log(`Operation failed: unsupported algorithm ${algorithm}`);
    return false;
  }

  const fullInput = resolvePath(input);

  const hash = createHash(algorithm);
  const hasher = new Transform({
    transform(chunk, encoding, cb) {
      hash.update(chunk);
      cb();
    },
  });

  try {
    await pipeline(createReadStream(fullInput), hasher);

    const digest = hash.digest("hex");
    console.log(`${algorithm}: ${digest}`);

    if (flags.save) {
      const outName = `${path.basename(fullInput)}.${algorithm}`;
      const outPath = path.join(path.dirname(fullInput), outName);
      await fs.writeFile(outPath, digest);
      console.log(`Hash saved to: ${outName}`);
    }

    return true;
  } catch (err) {
    console.log("Operation failed:", err.message);
    return false;
  }
}
