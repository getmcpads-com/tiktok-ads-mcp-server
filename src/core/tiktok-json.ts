/** Copyright 2026 getmcpads. SPDX-License-Identifier: Apache-2.0 */
/** TikTok sometimes returns pixel and other IDs as unquoted 64-bit integers.
 * Preserve their decimal spelling before JSON.parse can round them. */
export function parseTikTokJson(text: string): any {
  return JSON.parse(text.replace(/"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g, token => {
    if (token.startsWith('"') || !/^-?\d+$/.test(token)) return token;
    return Number.isSafeInteger(Number(token)) ? token : JSON.stringify(token);
  }));
}
