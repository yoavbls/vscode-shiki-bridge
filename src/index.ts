import { parse } from "jsonc-parser";
import { getVscode } from "./getVscode";

/**
 * Read the currently selected user theme's theme JSON.
 * Returns null when not running inside VS Code, no theme is configured,
 * or the theme file cannot be found/read.
 */
export async function getUserTheme() {
  try {
    const vscode = getVscode();
    const workbenchConfig = vscode.workspace.getConfiguration("workbench");
    const themeName = workbenchConfig.get<string>("colorTheme");

    if (!themeName) {
      return null;
    }

    const decoder = new TextDecoder("utf-8");

    for (const extension of vscode.extensions.all) {
      // `packageJSON` is `any` in VS Code's types; narrow the specific shape we need
      const contributions = (extension.packageJSON?.contributes?.themes ??
        []) as {
        id?: string;
        label?: string;
        path: string;
      }[];

      const matchedTheme = contributions.find(
        (contribution) =>
          contribution.path &&
          (contribution.id === themeName || contribution.label === themeName)
      );

      if (!matchedTheme) {
        continue;
      }

      try {
        const themeUri = vscode.Uri.joinPath(
          extension.extensionUri,
          matchedTheme.path
        );
        const rawBytes = await vscode.workspace.fs.readFile(themeUri);
        const jsonText = decoder.decode(rawBytes);
        const json = parse(jsonText) as Record<string, unknown>;
        return json;
      } catch {
        // If reading this theme fails, try the next extension (if any)
        continue;
      }
    }

    return null;
  } catch {
    // If the VS Code API is unavailable or any unexpected error occurs
    return null;
  }
}
