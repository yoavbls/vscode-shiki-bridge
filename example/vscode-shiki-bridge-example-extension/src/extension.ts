// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { codeToHtml } from "shiki";
import { getUserTheme } from "vscode-shiki-bridge";

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
      const themeJson = (await getUserTheme()) as any | null;

      // Render a sample code block with Shiki using the user's theme when available
      const codeSample = `// Hello from Shiki\nfunction greet(name: string) {\n  console.log(\`Hello, ${"${name}"}!\`);\n}\n\ninterface User { id: number; name: string }\nconst user: User = { id: 1, name: 'Ada' };\ngreet(user.name)`;

      const htmlSnippet = await codeToHtml(codeSample, {
        lang: "ts",
        theme: themeJson ?? "github-dark",
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
      html, body { margin: 0; padding: 0; background: transparent; font-family: ui-sans-serif, system-ui, sans-serif; }
      .container { padding: 16px; }
      pre { margin: 0; border-radius: 8px; overflow: auto; }
    </style>
  </head>
  <body>
    <div class="container">${htmlSnippet}</div>
  </body>
  </html>`;
    }
  );

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
