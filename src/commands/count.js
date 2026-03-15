import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";

export async function countWordsLines({ flags }, resolvePath) {
  const inputPath = flags.input;
  if (!inputPath) {
    console.log("Invalid input: --input is required");
    return false;
  }

  const fullPath = resolvePath(inputPath);

  let lines = 0;
  let words = 0;
  let characters = 0;

  const counter = new Transform({
    readableObjectMode: true,
    transform(chunk, encoding, callback) {
      const text = chunk.toString();
      characters += text.length;

      // count lines
      lines += (text.match(/\n/g) || []).length;
      if (text[text.length - 1] !== "\n" && text.length > 0) {
        // last non-empty chunk without newline
        if (lines === 0) lines = 1;
      }

      // count words (simple split on whitespace)
      words += text.split(/\s+/).filter(Boolean).length;

      callback();
    },
    flush(callback) {
      // final line if no trailing newline
      callback();
    },
  });

  try {
    await pipeline(createReadStream(fullPath), counter);

    console.log(`Lines: ${lines}`);
    console.log(`Words: ${words}`);
    console.log(`Characters: ${characters}`);
    return true;
  } catch (err) {
    console.log("Operation failed:", err.message);
    return false;
  }
}
