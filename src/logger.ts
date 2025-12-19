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

const isRunningExampleExtension = () => {
    const vscode = getVscode();
    const extension = vscode.extensions.getExtension('vscode-shiki-bridge.vscode-shiki-bridge-example-extension') ?? vscode.extensions.getExtension('vscode-shiki-bridge.vscode-shiki-bridge-advanced-example-extension');
    return !!extension;
};

const createOutputLog = () => {
    const vscode = getVscode();
    const output = vscode.window.createOutputChannel('vscode-shiki-bridge', { log: true });
    return {
        trace(message: any) { output.debug(message.toString()); },
        debug(message: any) { output.debug(message.toString()); },
        log(message: any) { output.info(message.toString()); },
        info(message: any) { output.info(message.toString()); },
        warn(message: any) { output.warn(message.toString()); },
        error(message: any) { output.error(message.toString()); },
    };
};

/**
 * When running an example extension, log to the `console` for to provide helpfull debug information and to enable inspecting values.
 * Else try to create an `LogOutputChannel` to log output, which will only write out the messages, not the additional parameters.
 * By using `trace` and `debug` for 'spammy' information, we prevent writing a lot of log output, as VS Code uses Log Level `INFO` by default.
 * Fallback on using a `no-op` logger, which does not write the log output anywhere.
 */
const logger: Logger = (function () {
    try {
        if (isRunningExampleExtension()) {
            return console;
        }
        return createOutputLog();
    } catch (_) {
        return noopLogger;
    }
})();

export { logger };
