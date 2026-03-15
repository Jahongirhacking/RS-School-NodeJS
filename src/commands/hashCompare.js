import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { pipeline } from "node:stream/promises";
import fs from "node:fs/promises";

const SUPPORTED = new Set(["sha256", "md5", "sha512"]);

export async function compareHash({ flags }, resolvePath) {
  const input = flags.input;
  const hashFile = flags.hash;
  if (!input || !hashFile) {
    console.log("Invalid input: --input and --hash are required");
    return false;
  }

  const algorithm = flags.algorithm || "sha256";
  if (!SUPPORTED.has(algorithm)) {
    console.log(`Operation failed: unsupported algorithm ${algorithm}`);
    return false;
  }

  const filePath = resolvePath(input);
  const hashPath = resolvePath(hashFile);

  let expected;
  try {
    expected = (await fs.readFile(hashPath, "utf-8")).trim().toLowerCase();
  } catch {
    console.log("Operation failed: cannot read hash file");
    return false;
  }

  const hash = createHash(algorithm);

  try {
    await pipeline(
      createReadStream(filePath),
      new Transform({
        transform(chunk, _, cb) {
          hash.update(chunk);
          cb();
        },
      }),
    );

    const actual = hash.digest("hex").toLowerCase();

    if (actual === expected) {
      console.log("OK");
    } else {
      console.log("MISMATCH");
    }
    return true;
  } catch (err) {
    console.log("Operation failed:", err.message);
    return false;
  }
}
