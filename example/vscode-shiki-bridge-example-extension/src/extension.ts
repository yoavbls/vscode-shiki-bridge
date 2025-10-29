// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { createHighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from 'shiki/engine/oniguruma';
import * as vscode from "vscode";
import { getUserLangs, getUserTheme } from "vscode-shiki-bridge";

let highlighter: ReturnType<typeof createHighlighterCore> | null = null;

async function getHighlighter(): NonNullable<typeof highlighter> {
  if (highlighter === null) {
    highlighter = createHighlighterCore({
      engine: createOnigurumaEngine(import('shiki/wasm')),
    });
  }
  return highlighter;
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error) during debugging
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "vscode-shiki-bridge-example-extension" is now active!'
  );

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const disposable = vscode.commands.registerCommand(
    "vscode-shiki-bridge-example-extension.shikiPreview",
    async () => {
      // Resolve current VS Code theme JSON (may be null if unavailable)
      const [theme, themes] = await getUserTheme();
      const langs = await getUserLangs(['typescript', 'type']);

      console.log({ theme, themes, langs });

      // NOTE: it is recommended to cache this instance and dynammically load themes and languages
      // see: https://shiki.style/guide/bundles#fine-grained-bundle
      const highlighter = await getHighlighter();

      // dynamically load themes that are not loaded yet
      const loadedThemes = highlighter.getLoadedThemes();
      const unloadedThemes = themes.filter(theme => {
        if (!theme.name) {
          return false;
        }
        return !loadedThemes.includes(theme.name);
      });
      if (unloadedThemes.length > 0) {
        await highlighter.loadTheme(...unloadedThemes);
      }

      // dynamically load languages that are not loaded yet
      const loadedLanguages = highlighter.getLoadedLanguages();
      const unloadedLanguages = langs.filter(lang => !loadedLanguages.includes(lang.name));
      if (unloadedLanguages.length > 0) {
        await highlighter.loadLanguage(...unloadedLanguages);
      }

      const typeSnippet = highlighter.codeToHtml(
        `string | number | Partial<{ a: string }>[]`,
        {
          lang: "type",
          theme,
        }
      );

      const typescriptSnippet = highlighter.codeToHtml(`
type User = {
    name: string,
    age: number,
};

const thing: User = {
    name: 'Jane Doe',
    age: 23,
}`,
        {
          lang: "typescript",
          theme,
        }
      );

      const javascriptSnippet = highlighter.codeToHtml(`
/**
 * @param {number} delay
 */
async function wait(delay) {
  return Promise(resolve => setTimeout(resolve, delay));
}
        `, {
          lang: 'typescript',
          theme,
        });

      const panel = vscode.window.createWebviewPanel(
        "vscodeShikiBridgeExample",
        "Shiki Preview",
        vscode.ViewColumn.Active,
        { enableScripts: false }
      );

      panel.webview.html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Shiki Preview</title>
    <style>
      body {
        font-family: system-ui, -apple-system, sans-serif;
        padding: 20px;
        margin: 0;
      }
      h3 {
        margin: 10px 0;
      }
      pre.shiki code {
        padding: 8px;
        display: block;
        border-radius: 8px;
        line-height: 1;
      }
      pre.shiki .line {
        display: block;
      }
    </style>
  </head>
  <body>
      <div class="container">
        <h2><pre><code>type</code><pre></h2>
        ${typeSnippet}
      </div>
      <div class="container">
        <h2><pre><code>typescript</code><pre></h2>
        ${typescriptSnippet}
      </div>
      <div class="container">
        <h2><pre><code>javascript</code><pre></h2>
        ${javascriptSnippet}
      </div>
  </body>
</html>`;
    }
  );

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
