import type { SpecialTheme, ThemeRegistration } from "shiki";
import { ThemeRegistry } from "./theme-registry.js";
import { getVscode, ExtensionFileReader } from "./vscode-utils.js";
import { logger } from "./logger.js";
import { buildThemeRegistration } from "./shiki-bridge-theme.js";

export type UserThemeResult = [id: string, theme: ThemeRegistration] | [id: string, theme: SpecialTheme];

let cache: ThemeRegistry | null = null;
function getThemeRegistry(vscode: typeof import('vscode')): ThemeRegistry {
  if (!cache) {
    cache = ThemeRegistry.build(vscode.extensions.all);
    vscode.extensions.onDidChange(() => {
      cache = null;
    });
  }
  return cache;
}

export async function getUserTheme(): Promise<UserThemeResult> {
  const vscode = getVscode();
  const registry = getThemeRegistry(vscode);
  const fileReader = new ExtensionFileReader(vscode);

  const workbenchConfig = vscode.workspace.getConfiguration("workbench");
  const themeName = workbenchConfig.get<string>("colorTheme");

  if (!themeName) {
    logger.debug('no theme name found under workbench.colorTheme');
    return THEME_NOT_FOUND_RESULT;
  }

  const themeId = registry.resolveLabelToId(themeName);
  const contribution = registry.themes.get(themeId);
  if (!contribution) {
    logger.debug(`no theme contribution found for theme id ${themeId}`);
    return THEME_NOT_FOUND_RESULT;
  }

  const themeRegistration = await buildThemeRegistration(contribution, registry, fileReader, vscode.Uri);
  return [themeId, themeRegistration];
}

const THEME_NOT_FOUND_RESULT: [string, SpecialTheme] = ["none", "none"];
