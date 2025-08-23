export function getVscode(): typeof import("vscode") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("vscode");
  } catch {
    throw new Error(
      "vscode-shiki-bridge: The 'vscode' API is only available inside the VS Code extension host."
    );
  }
}
