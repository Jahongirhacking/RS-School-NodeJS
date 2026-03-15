import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { promisify } from "node:util";
const scryptAsync = promisify(crypto.scrypt);

const ALGORITHM = "aes-256-gcm";
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

export async function decryptFile({ flags }, resolvePath) {
  const input = flags.input;
  const output = flags.output;
  const password = flags.password;

  if (!input || !output || !password) {
    console.log("Invalid input: --input, --output, --password required");
    return false;
  }

  const inPath = resolvePath(input);
  const outPath = resolvePath(output);

  try {
    const fd = await fs.open(inPath, "r");
    const header = Buffer.alloc(SALT_LEN + IV_LEN);
    await fd.read(header, 0, header.length, 0);

    const salt = header.subarray(0, SALT_LEN);
    const iv = header.subarray(SALT_LEN, SALT_LEN + IV_LEN);

    const stats = await fd.stat();
    const tagPos = stats.size - TAG_LEN;
    const tagBuf = Buffer.alloc(TAG_LEN);
    await fd.read(tagBuf, 0, TAG_LEN, tagPos);

    const key = await scryptAsync(password, salt, KEY_LEN);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tagBuf);

    const rs = fd.createReadStream({
      start: SALT_LEN + IV_LEN,
      end: tagPos - 1,
    });

    await pipeline(rs, decipher, createWriteStream(outPath));

    await fd.close();
    console.log(`Decrypted: ${output}`);
    return true;
  } catch (err) {
    console.log("Operation failed:", err.message);
    return false;
  }
}
