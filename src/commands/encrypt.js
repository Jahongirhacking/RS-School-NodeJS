import { createReadStream, createWriteStream } from "node:fs";
import { pipeline, Transform } from "node:stream";
import crypto from "node:crypto";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";
const scryptAsync = promisify(crypto.scrypt);

const ALGORITHM = "aes-256-gcm";
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

export async function encryptFile({ flags }, resolvePath) {
  const input = flags.input;
  const output = flags.output;
  const password = flags.password;

  if (!input || !output || !password) {
    console.log("Invalid input: --input, --output, --password required");
    return false;
  }

  const inPath = resolvePath(input);
  const outPath = resolvePath(output);

  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);

  let key;
  try {
    key = await scryptAsync(password, salt, KEY_LEN);
  } catch (err) {
    console.log("Operation failed:", err.message);
    return false;
  }

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  cipher.setAutoPadding(true);

  let authTag;

  const tagSaver = new Transform({
    transform(chunk, enc, cb) {
      this.push(chunk);
      cb();
    },
    flush(cb) {
      authTag = cipher.getAuthTag();
      cb();
    },
  });

  try {
    const ws = createWriteStream(outPath);
    ws.write(salt);
    ws.write(iv);

    await pipeline(createReadStream(inPath), cipher, tagSaver, ws);

    ws.write(authTag);
    ws.end();

    console.log(`Encrypted: ${output}`);
    return true;
  } catch (err) {
    console.log("Operation failed:", err.message);
    return false;
  }
}
