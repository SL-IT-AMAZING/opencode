// Stub messaging module - VS Code messaging not available in standalone mode
// Image upload functionality will be implemented later via OpenCode API

import type { HostToUIMessage, TextEdit } from './types';

export type MessageHandler = (message: HostToUIMessage) => void;

// Stub functions - no-op in standalone mode
export function postMessage(): void {
  // No-op
}

export function requestInit(): void {
  // No-op
}

export function requestSettings(): void {
  // No-op
}

export function applyTextEdits(
  _edits: TextEdit[],
  _reason: 'typing' | 'drag' | 'paste' | 'format'
): void {
  // No-op - changes are handled via onChange callback
}

export function writeAsset(_dataUri: string, _suggestedName?: string): void {
  console.warn('Image upload not yet supported in standalone mode');
}

export function addMessageHandler(_handler: MessageHandler): () => void {
  // Return cleanup function
  return () => {};
}
