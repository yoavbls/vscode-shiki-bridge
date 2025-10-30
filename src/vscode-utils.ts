import type { Uri } from "vscode";
import type { ParseError } from 'jsonc-parser';
import CSON from 'cson';
import { parse as parsePlist } from 'fast-plist';
import YAML from 'js-yaml';
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

export function parseJsonc(jsonc: string) {
  const errors: ParseError[] = [];
  const result = jsoncParse(jsonc, errors, {
    allowEmptyContent: true,
    allowTrailingComma: true,
  });
  if (errors.length)
    throw new AggregateError(errors, 'failed to parse JSONC');
  return result;
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
    const json = parseJsonc(text);
    return json as T;
  }

  // based on https://github.com/shikijs/textmate-grammars-themes/blob/main/scripts/shared/parse.ts
  async readTmLanguage<T>(base: Uri, path: string): Promise<T> {
    const uri = this.vscode.Uri.joinPath(base, path);
    let raw = await this.readFile(base, path);
    if (uri.path.endsWith('.cson')) {
      return CSON.parse(raw);
    } else if (uri.path.endsWith('.json')) {
      return parseJsonc(raw);
    } else if (uri.path.endsWith('.plist')) {
      return parsePlist(raw);
    } else if (uri.path.endsWith('.yml') || uri.path.endsWith('.yaml')) {
      return YAML.load(raw) as T;
    } else {
      raw = raw.trimStart();
      if (raw[0] === '{')
        return parseJsonc(raw);
      else if (raw[0] === '<')
        return parsePlist(raw);
      else
        return YAML.load(raw) as T;
    }
  }
}
