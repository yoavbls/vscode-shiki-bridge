import type { ThemeRegistration } from "shiki";
import { ThemeRegistry } from "./theme-registry.js";
import { getVscode, ExtensionFileReader } from "./vscode-utils.js";
import { logger } from "./logger.js";
import { buildThemeRegistration } from "./theme-registration-builder.js";

export type UserThemeResult = [id: string, themes: [ThemeRegistration]];

let cache: ThemeRegistry | null = null;
function getThemeRegistry(vscode: typeof import('vscode')): ThemeRegistry {
  if (!cache) {
    cache = new ThemeRegistry(vscode.extensions.all);
    const disposable = vscode.extensions.onDidChange(() => {
      cache = null;
      disposable.dispose();
    });
  }
  return cache;
}

/**
 * Get the `ThemeRegistration` for the currently active theme.
 */
export async function getUserTheme(): Promise<UserThemeResult> {
  const vscode = getVscode();
  const workbenchConfig = vscode.workspace.getConfiguration("workbench");
  const themeName = workbenchConfig.get<string>("colorTheme")!;
  return await getTheme(themeName);
}

/**
 * Get the `ThemeRegistration` for the given `themeName`.
 *
 * The `themeName` can be a theme's `label` or `id`, themes might define only one of these properties, `vscode-shiki-bridge` accepts both and will resolve it to the correct theme.
 * @param themeName
 */
export async function getTheme(themeName: string): Promise<UserThemeResult> {
  const vscode = getVscode();
  const registry = getThemeRegistry(vscode);
  const fileReader = new ExtensionFileReader(vscode);

  const themeId = registry.resolveLabelToId(themeName);
  const contribution = registry.themes.get(themeId);
  if (!contribution) {
    const message = `no theme contribution found for theme id ${themeId}`;
    logger.debug(message);
    throw new Error(message);
  }

  const themeRegistration = await buildThemeRegistration(contribution, registry, fileReader, vscode.Uri);
  return [themeId, [themeRegistration]];
}
