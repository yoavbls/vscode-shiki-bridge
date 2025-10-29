import type { TextDocumentContentProvider } from "vscode";
import { getInspectLanguageRegistrationTextDocumentContent } from "./inspect-internals.js";

export const textDocumentContentProvider: TextDocumentContentProvider = {
    async provideTextDocumentContent(uri, token) {
      const [,type, arg] = uri.path.split('/');
      switch (type) {
        case 'inspect-language-registration': {
          const languageId = arg.replace('.json', '');
          return getInspectLanguageRegistrationTextDocumentContent(languageId);
        }
        default: {
          return;
        }
      }
    }
};
