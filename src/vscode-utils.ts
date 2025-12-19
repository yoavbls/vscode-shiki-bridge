import type { Uri } from "vscode";
import type { ParseError } from 'jsonc-parser';
import { parse as parsePlist } from 'fast-plist';
import { parse as jsoncParse } from 'jsonc-parser';

export function getVscode(): typeof import("vscode") {
  try {
    return require("vscode");
  } catch {
    throw new Error(
      "vscode-shiki-bridge: The 'vscode' API is only available inside the VS Code extension host."
    );
  }
}

function parseJsonc(jsonc: string) {
  const errors: ParseError[] = [];
  const result = jsoncParse(jsonc, errors, {
    allowEmptyContent: true,
    allowTrailingComma: true,
  });
  if (errors.length) {
    throw new AggregateError(errors, 'failed to parse JSONC');
  }
  return result;
}

/**
 * A helper class to read files from extension directories. Uses a `jsonc` parser to parse JSON.
 */
export class ExtensionFileReader {
  constructor(private readonly vscode: typeof import('vscode'), private readonly decoder = new TextDecoder('utf-8')) {}

  async readFile(base: Uri, path?: string): Promise<string> {
    const uri = path ? this.vscode.Uri.joinPath(base, path) : base;
    const bytes = await this.vscode.workspace.fs.readFile(uri);
    const text = this.decoder.decode(bytes);
    return text;
  }

  async readJson<T>(base: Uri, path?: string): Promise<T> {
    const text = await this.readFile(base, path);
    const json = parseJsonc(text);
    return json as T;
  }

  async readPlist<T>(base: Uri, path?: string): Promise<T> {
    const text = await this.readFile(base, path);
    const plist = parsePlist(text);
    return plist as T;
  }

  /**
   * TextMate grammar/language files can be written in JSON (with comments) or XML PList formats.
   * If the path ends with `.json[c]`, it will be parsed as JSON, else it will be assumed to be a PList
   */
  async readTmLanguage<T>(base: Uri, path?: string): Promise<T> {
    const pathWithExtension = path ?? base.path;
    if (pathWithExtension.endsWith('.json') || pathWithExtension.endsWith('.jsonc')) {
      return this.readJson(base, path);
    } else {
      return this.readPlist(base, path);
    }
  }
}
