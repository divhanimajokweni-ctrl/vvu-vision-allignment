// VVU Studio lib — agent module
// The agent panel's suggestion chips — quick prompts the operator can click
// to ask the workspace agent. Pure data, no I/O.

/** The suggestion chips rendered below the agent's chat body. Clicking one
 *  sends it as an operator message. */
export const SUGGESTIONS: readonly string[] = [
  "explain the loop",
  "what is a receipt?",
  "why stubbed gates?",
  "how does merkle verify work?",
  "what is the stranger test?",
  "show me the gates",
] as const;
