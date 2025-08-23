import { parse } from "jsonc-parser";
import { getVscode } from "./vscode-utils";
import type { SpecialTheme, ThemeRegistrationAny } from "shiki/types";

/**
 * Read the currently selected user theme's theme JSON.
 * Returns null when not running inside VS Code, no theme is configured,
 * or the theme file cannot be found/read.
 */
export async function getUserTheme(): Promise<
  [string, ThemeRegistrationAny[]]
> {
  try {
    const vscode = getVscode();
    const workbenchConfig = vscode.workspace.getConfiguration("workbench");
    const themeName = workbenchConfig.get<string>("colorTheme");

    if (!themeName) {
      return THEME_NOT_FOUND_RESULT;
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
        const json = parse(jsonText) as ThemeRegistrationAny;
        if (json.name) {
          return [json.name, [json]];
        }
        return THEME_NOT_FOUND_RESULT;
      } catch {
        // If reading this theme fails, try the next extension (if any)
        continue;
      }
    }

    return THEME_NOT_FOUND_RESULT;
  } catch {
    // If the VS Code API is unavailable or any unexpected error occurs
    return THEME_NOT_FOUND_RESULT;
  }
}

const THEME_NOT_FOUND_RESULT: [SpecialTheme, ThemeRegistrationAny[]] = [
  "none",
  [],
];
