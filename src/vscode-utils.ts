import type { Uri } from "vscode";
import { parse } from "jsonc-parser";

export function getVscode(): typeof import("vscode") {
  try {
    return require("vscode");
  } catch {
    throw new Error(
      "vscode-shiki-bridge: The 'vscode' API is only available inside the VS Code extension host."
    );
  }
}

export class ExtensionFileReader {
  constructor(private readonly vscode: typeof import('vscode'), private readonly decoder = new TextDecoder('utf-8')) {}

  async readFile(base: Uri, path: string): Promise<string> {
    const uri = this.vscode.Uri.joinPath(base, path);
    const bytes = await this.vscode.workspace.fs.readFile(uri);
    const text = this.decoder.decode(bytes);
    return text;
  }

  async readJson<T>(base: Uri, path: string): Promise<T> {
    const text = await this.readFile(base, path);
    // TODO: do something with parse errors?
    const json = parse(text);
    return json as T;
  }
}
