import * as vscode from "vscode";
import { getUserLangs as _getUserLangs } from "vscode-shiki-bridge";
import { ExtensionFileReader, LanguageRegistrationCollectionBuilder, Registry } from 'vscode-shiki-bridge/internals';

let cachedUserLangs: ReturnType<typeof _getUserLangs> | null = null;

function getUserLangs() {
  if (!cachedUserLangs) {
    cachedUserLangs = _getUserLangs();
  }
  return cachedUserLangs;
}

const actions = {
  'Inspect Language Registration': inspectLanguageRegistration,
} as const;

export async function inspectInternals() {
  const action = await vscode.window.showQuickPick(Object.keys(actions), {
    placeHolder: 'Choose an Action',
    title: 'Inspect Internals',
  }) as keyof typeof actions | undefined;
  if (!action || !(action in actions)) {
    return;
  }
  return actions[action]();
}

export async function inspectLanguageRegistration() {
  const result = await getUserLangs();
  const languageId = await vscode.window.showQuickPick(result.languages.map(lang => lang.name), {
    ignoreFocusOut: true,
    placeHolder: 'Choose a Language ID',
    title: "Inspect Language Registration",
  });
  if (!languageId) {
    return;
  }
  const uri = vscode.Uri.file(`inspect-language-registration/${languageId}.json`).with({ scheme: 'vscode-shiki-bridge' });
  await vscode.window.showTextDocument(uri);
}

export async function getInspectLanguageRegistrationTextDocumentContent(languageId: string): Promise<string> {
  const result = await getUserLangs();
  const language = result.get(languageId);
  if (!language) {
    return JSON.stringify({
      "error": `no language found for ${languageId}`,
    }, null, 2);
  }
  const text = JSON.stringify(language, null, 2);
  return text;
}
