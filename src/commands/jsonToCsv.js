import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";

export async function jsonToCsv({ flags }, resolvePath) {
  const input = flags.input;
  const output = flags.output;
  if (!input || !output) {
    console.log("Invalid input: --input and --output required");
    return false;
  }

  const inPath = resolvePath(input);
  const outPath = resolvePath(output);

  let headers = null;

  try {
    const content = await fs.readFile(inPath, "utf-8");
    const data = JSON.parse(content);

    if (!Array.isArray(data) || data.length === 0) {
      console.log("Operation failed: JSON must be array of objects");
      return false;
    }

    headers = Object.keys(data[0]);

    const ws = createWriteStream(outPath);
    ws.write(headers.join(",") + "\n");

    for (const row of data) {
      const values = headers.map((h) =>
        JSON.stringify(row[h] ?? "").replace(/"/g, '""'),
      );
      ws.write(values.join(",") + "\n");
    }

    ws.end();
    console.log(`Converted ${input} → ${output}`);
    return true;
  } catch (err) {
    console.log("Operation failed:", err.message);
    return false;
  }
}
