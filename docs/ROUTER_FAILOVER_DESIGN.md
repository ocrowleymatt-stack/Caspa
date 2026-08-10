# Atlas router failover

Quota and billing exhaustion must be treated as a routing signal, not a terminal job failure.

The canonical routing path is:

1. Classify the task and intelligence mode.
2. Select the best configured/healthy cloud provider.
3. If a provider reports billing/quota exhaustion, mark that provider unavailable for the current request and continue immediately to the next provider.
4. Do not waste retries on sibling models that share the same exhausted provider billing boundary.
5. If all paid cloud providers fail, continue through the free-model pool.
6. If no cloud model can answer, use the configured self-hosted/Ollama route as survival mode.
7. Preserve the same prompt, task classification, JSON requirement and token budget across failover.

A requested model is a preference, not permission to terminate the job when its provider is unavailable, unless an explicit strict-model mode is introduced later.
