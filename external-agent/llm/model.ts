import type { BaseLlm } from '@google/adk';

import { OllamaLlm } from './ollama-llm.js';

const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';
const DEFAULT_OLLAMA_MODEL = 'llama3.1';
const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';

function normalizeOllamaBaseUrl(raw: string): string {
  return raw.replace(/\/v1\/?$/, '');
}

function resolveOllamaModel(modelName: string): OllamaLlm {
  const baseUrl = normalizeOllamaBaseUrl(
    process.env['OLLAMA_BASE_URL']?.trim() ?? DEFAULT_OLLAMA_BASE_URL,
  );
  return new OllamaLlm(modelName, baseUrl);
}

/**
 * Resolves the LLM for the WebMCP agent.
 *
 * Priority:
 * 1. ADK_MODEL=gemini-* → Gemini (default: gemini-3.5-flash)
 * 2. ADK_MODEL=ollama / llama* → local Ollama
 * 3. GEMINI_API_KEY set, no ADK_MODEL → Gemini (recommended)
 * 4. Fallback → Ollama llama3.1
 */
export function resolveAgentModel(): string | BaseLlm {
  const configuredModel = process.env['ADK_MODEL']?.trim();

  if (configuredModel?.startsWith('gemini')) {
    return configuredModel;
  }

  if (configuredModel === 'ollama' || configuredModel?.startsWith('llama')) {
    const modelName =
      configuredModel === 'ollama'
        ? (process.env['OLLAMA_MODEL']?.trim() ?? DEFAULT_OLLAMA_MODEL)
        : configuredModel;
    return resolveOllamaModel(modelName);
  }

  if (process.env['GEMINI_API_KEY']) {
    return process.env['GEMINI_MODEL']?.trim() ?? DEFAULT_GEMINI_MODEL;
  }

  if (configuredModel) {
    return resolveOllamaModel(configuredModel);
  }

  return resolveOllamaModel(process.env['OLLAMA_MODEL']?.trim() ?? DEFAULT_OLLAMA_MODEL);
}
