import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { resolvePath } from "./utils/pathResolver.js";

let currentDir = os.homedir();

export function getCurrentDir() {
  return currentDir;
}

export function printCurrentDir() {
  console.log(`You are currently in ${currentDir}`);
}

export async function initializeNavigation() {
  currentDir = await fs.realpath(os.homedir());
}

export async function cmd_up() {
  const parent = path.dirname(currentDir);
  if (parent === currentDir) {
    // already at root
    return false;
  }
  currentDir = parent;
  return true;
}

export async function cmd_cd(target, resolvePath) {
  if (!target || typeof target !== "string") {
    console.log("Invalid input: cd requires a directory path");
    return false;
  }

  const newPath = resolvePath(target);

  try {
    const stat = await fs.stat(newPath);
    if (!stat.isDirectory()) {
      console.log("Operation failed: not a directory");
      return false;
    }
    currentDir = await fs.realpath(newPath);
    return true;
  } catch (err) {
    console.log("Operation failed: directory not found or inaccessible");
    return false;
  }
}

export async function cmd_ls() {
  try {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    const folders = [];
    const files = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        folders.push(entry.name);
      } else {
        files.push(entry.name);
      }
    }

    folders.sort();
    files.sort();

    for (const name of folders) {
      console.log(`${name.padEnd(30)} [folder]`);
    }
    for (const name of files) {
      console.log(`${name.padEnd(30)} [file]`);
    }
  } catch (err) {
    console.log("Operation failed:", err.message);
  }
}
