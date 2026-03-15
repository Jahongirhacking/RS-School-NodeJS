import fs from "node:fs";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";

export async function csvToJson({ flags }, resolvePath) {
  const input = flags.input;
  const output = flags.output;

  if (!input || !output) {
    console.log("Invalid input: --input and --output are required");
    return false;
  }

  const inputPath = resolvePath(input);
  const outputPath = resolvePath(output);

  let headers = null;
  let isFirstRow = true;

  const csvParser = new Transform({
    readableObjectMode: true,
    transform(chunk, encoding, callback) {
      const lines = chunk.toString().split("\n");

      for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        const values = line
          .split(",")
          .map((v) => v.trim().replace(/^"|"$/g, ""));

        if (isFirstRow) {
          headers = values;
          isFirstRow = false;
          continue;
        }

        if (headers && values.length === headers.length) {
          const obj = {};
          headers.forEach((header, i) => {
            obj[header] = values[i];
          });
          this.push(obj);
        }
      }

      callback();
    },
  });

  let firstObject = true;

  const jsonSerializer = new Transform({
    writableObjectMode: true,
    readableObjectMode: false,
    transform(obj, encoding, callback) {
      const json = JSON.stringify(obj);

      if (firstObject) {
        this.push("[\n  " + json);
        firstObject = false;
      } else {
        this.push(",\n  " + json);
      }

      callback();
    },
    flush(callback) {
      if (!firstObject) {
        this.push("\n]");
      } else {
        // empty file case
        this.push("[]");
      }
      callback();
    },
  });

  try {
    await pipeline(
      fs.createReadStream(inputPath),
      csvParser,
      jsonSerializer,
      fs.createWriteStream(outputPath, { encoding: "utf8" }),
    );

    console.log(`Converted ${input} → ${output}`);
    return true;
  } catch (err) {
    console.log("Operation failed:", err.message);
    return false;
  }
}
