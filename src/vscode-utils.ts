export function getVscode(): typeof import("vscode") {
  try {
    return require("vscode");
  } catch {
    throw new Error(
      "vscode-shiki-bridge: The 'vscode' API is only available inside the VS Code extension host."
    );
  }
}
