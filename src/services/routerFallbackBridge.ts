import { callWithProviderFailover, type RouterFailoverOptions, type RouterFailoverResult } from './routerFailover';

/**
 * Stable entry point for Atlas features that need automatic model selection.
 * Existing callers can migrate to this without depending on provider-specific
 * routing internals.
 */
export async function routeAtlasPrompt(
  prompt: string,
  options: RouterFailoverOptions = {},
): Promise<RouterFailoverResult> {
  return callWithProviderFailover(prompt, options);
}
