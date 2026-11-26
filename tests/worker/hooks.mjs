// Lets Node run the Worker's TypeScript as is: the Worker imports its own
// modules without an extension ("./env"), which wrangler's bundler accepts
// but Node's ESM loader does not. Node strips the types itself.
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, next) {
    if (
      specifier.startsWith('.') &&
      !/\.[cm]?[jt]s$/.test(specifier) &&
      context.parentURL?.endsWith('.ts')
    )
      return next(`${specifier}.ts`, context);
    return next(specifier, context);
  },
});
