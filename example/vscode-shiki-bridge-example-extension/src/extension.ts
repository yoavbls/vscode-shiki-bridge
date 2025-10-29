// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { createHighlighter } from "shiki";
import * as vscode from "vscode";
import { getUserLangs, getUserTheme } from "vscode-shiki-bridge";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
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
      const result = await getUserLangs(["graphql", "type"]);

      const highlighter = await createHighlighter({
        themes,
        langs: result.languages,
      });

      const htmlSnippet = highlighter.codeToHtml(
        `string | number | Partial<{ a: string }>[]`,
        {
          lang: "type",
          theme,
        }
      );

      const gqlHtmlSnippet = highlighter.codeToHtml(
        `type User {
    name: String
    age: Int
}`,
        {
          lang: "graphql",
          theme,
        }
      );

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
      <div class="container">${htmlSnippet}</div>
    ${
      gqlHtmlSnippet ? `GQL:<div class="container">${gqlHtmlSnippet}</div>` : ""
    }
  </body>
</html>`;
    }
  );

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
