import { getVscode } from "./vscode-utils.js";

type LogMethod = 'trace' | 'debug' | 'log' | 'info' | 'warn' | 'error';

export type Logger = Pick<typeof console, LogMethod>;

const noopLogger: Logger = {
    trace() {},
    debug() {},
    log() {},
    info() {},
    warn() {},
    error() {},
};

/**
 * We would use [`ExtensionContext.extensionMode`](https://code.visualstudio.com/api/references/vscode-api#ExtensionContext) but since we don't have acces to it,
 * We probe for the `vscode-shiki-bridge-example-extension` being available
 */
const isDebugMode = () => {
    const vscode = getVscode();
    const extension = vscode.extensions.getExtension('vscode-shiki-bridge.vscode-shiki-bridge-example-extension');
    return !!extension;
};

const logger: Logger = (function () {
    try {
        if (isDebugMode()) {
            return console;
        }
        return noopLogger;
    } catch (_) {
        return noopLogger;
    }
})();

export { logger };
