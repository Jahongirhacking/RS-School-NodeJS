import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { parseArgs } from "./utils/argParser.js";
import { resolvePath } from "./utils/pathResolver.js";
import { printCurrentDir, cmd_up, cmd_cd, cmd_ls } from "./navigation.js";
// commands
import { csvToJson } from "./commands/csvToJson.js";
import { jsonToCsv } from "./commands/jsonToCsv.js";
import { countWordsLines } from "./commands/count.js";
import { calculateHash } from "./commands/hash.js";
import { compareHash } from "./commands/hashCompare.js";
import { encryptFile } from "./commands/encrypt.js";
import { decryptFile } from "./commands/decrypt.js";
import { computeLogStats } from "./commands/logStats.js";

const COMMANDS = {
  up: { handler: cmd_up, needsArgs: false },
  cd: { handler: cmd_cd, needsArgs: true },
  ls: { handler: cmd_ls, needsArgs: false },
  "csv-to-json": { handler: csvToJson, needsArgs: true },
  "json-to-csv": { handler: jsonToCsv, needsArgs: true },
  count: { handler: countWordsLines, needsArgs: true },
  hash: { handler: calculateHash, needsArgs: true },
  "hash-compare": { handler: compareHash, needsArgs: true },
  encrypt: { handler: encryptFile, needsArgs: true },
  decrypt: { handler: decryptFile, needsArgs: true },
  "log-stats": { handler: computeLogStats, needsArgs: true },
  ".exit": {
    handler: () => {
      throw new Error("ExitPrompt");
    },
  },
};

export function welcome() {
  console.log("Welcome to Data Processing CLI!");
}

export function goodbye() {
  console.log("\nThank you for using Data Processing CLI!");
}

export async function startREPL() {
  const rl = readline.createInterface({
    input: stdin,
    output: stdout,
    prompt: "> ",
  });

  rl.prompt();

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) {
      rl.prompt();
      continue;
    }

    const [command, ...rawArgs] = trimmed.split(/\s+/);
    const parsed = parseArgs(rawArgs);

    const cmd = COMMANDS[command];

    if (!cmd) {
      console.log("Invalid input");
    } else if (command === "cd") {
      const target = parsed.positional[0] || "";
      await cmd_cd(target, resolvePath);
      printCurrentDir();
    } else if (
      cmd.needsArgs &&
      parsed.positional.length === 0 &&
      Object.keys(parsed.flags).length === 0
    ) {
      console.log("Invalid input: missing arguments");
    } else {
      try {
        const success = await cmd.handler(parsed, resolvePath);
        if (success !== false) {
          printCurrentDir();
        }
      } catch (err) {
        console.log("Operation failed:", err.message);
      }
    }

    rl.prompt();
  }
}
