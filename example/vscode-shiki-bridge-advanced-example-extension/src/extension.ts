import * as vscode from "vscode";
import { showShikiPreview } from "./preview.js";
import { inspectInternals, textDocumentContentProvider } from "./inspect-internals.js";

/**
 * This is a more advanced example used to test the `vscode-shiki-bridge` library
 * For a simpler example on how to use `vscode-shiki-bridge` see `vscode-shiki-bridge-example-extension`
 */
export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "vscode-shiki-bridge-example-extension.shikiPreview",
      showShikiPreview,
    ),
    vscode.commands.registerCommand(
      "vscode-shiki-bridge-example-extension.inspectInternals",
      inspectInternals,
    ),
    vscode.workspace.registerTextDocumentContentProvider(
      textDocumentContentProvider.scheme,
      textDocumentContentProvider,
    )
  );
}

export function deactivate() {}
