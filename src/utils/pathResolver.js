import path from "node:path";
import { getCurrentDir } from "../navigation.js";

export function resolvePath(userPath) {
  if (path.isAbsolute(userPath)) {
    return userPath;
  }
  return path.join(getCurrentDir(), userPath);
}
