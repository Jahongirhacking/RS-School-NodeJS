import { welcome, goodbye } from "./repl.js";
import { initializeNavigation, printCurrentDir } from "./navigation.js";
import { startREPL } from "./repl.js";

console.clear();

(async () => {
  await initializeNavigation();
  welcome();
  printCurrentDir();
  try {
    await startREPL();
  } catch (err) {
    if (err.name !== "ExitPrompt") {
      console.error("Unexpected error:", err.message);
    }
  }
  goodbye();
})();
