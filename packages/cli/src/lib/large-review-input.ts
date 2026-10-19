import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { none } from 'stream-chain/core';
import exec from 'stream-chain/exec.js';
import parser, { type Token } from 'stream-json/core/parser.js';
import ignore from 'stream-json/core/filters/ignore.js';
import stringer from 'stream-json/core/stringer.js';

export const REVIEW_INPUT_LIMIT = 1024 * 1024 * 1024;
export const REVIEW_DATA_LIMIT = 128 * 1024 * 1024;

/** Stream diagnostics out before assembling JSON; never rewrite the original report. */
export async function readLargeReviewReport(file: string, limits = { input: REVIEW_INPUT_LIMIT, retained: REVIEW_DATA_LIMIT }) {
  const hash = createHash('sha256');
  let inputBytes = 0;
  let retainedBytes = 0;
  let omittedStatusReasons = 0;
  let keyBytes = 0;
  let inKey = false;
  const source = createReadStream(file, { highWaterMark: 64 * 1024 });
  const consume = exec(
    parser({ packStrings: false, packNumbers: false }),
    (token: Token) => {
      // Packed keys are needed for path matching; cap them while still streaming.
      if (token.name === 'startKey') { keyBytes = 0; inKey = true; }
      if (inKey && token.name === 'stringChunk') {
        keyBytes += Buffer.byteLength(token.value);
        if (keyBytes > 1024 * 1024) throw new Error('Report property name exceeds the 1 MiB import limit.');
      }
      if (token.name === 'endKey') inKey = false;
      return token;
    },
    ignore({ streamKeys: false, filter: (keys, token) => {
      // Match path segments, not a dotted regex: report file names can contain dots.
      if (keys.length === 5 && keys[0] === 'files' && typeof keys[1] === 'string' &&
          keys[2] === 'mutants' && typeof keys[3] === 'number' && keys[4] === 'statusReason' && token.name === 'startString') {
        omittedStatusReasons++;
        return true;
      }
      return false;
    } }),
    stringer({ useKeyValues: true })
  );
  const parts: Buffer[] = [];
  let pending = Buffer.allocUnsafe(64 * 1024);
  let pendingBytes = 0;
  const collect = (part: string) => {
    retainedBytes += Buffer.byteLength(part);
    if (retainedBytes > limits.retained) throw new Error('Report data exceeds the 128 MiB limit after omitting mutant statusReason diagnostics.');
    // Copy retained text: tiny sliced strings must not keep diagnostic-sized
    // input chunks alive. UTF-16 preserves surrogate pairs across token boundaries.
    const encoded = Buffer.from(part, 'utf16le');
    for (let offset = 0; offset < encoded.length;) {
      const length = Math.min(pending.length - pendingBytes, encoded.length - offset);
      encoded.copy(pending, pendingBytes, offset, offset + length);
      pendingBytes += length;
      offset += length;
      if (pendingBytes === pending.length) {
        parts.push(pending);
        pending = Buffer.allocUnsafe(64 * 1024);
        pendingBytes = 0;
      }
    }
  };
  try {
    for await (const chunk of source) {
      inputBytes += chunk.length;
      if (inputBytes > limits.input) throw new Error('Report exceeds the 1 GiB import limit.');
      hash.update(chunk);
      // Consume each chunk before reading more; no per-token async queue.
      await consume(chunk, collect);
    }
    // Flush the parser to validate EOF and emit delayed closing tokens.
    await consume(none, collect);
    parts.push(pending.subarray(0, pendingBytes));
    return { value: JSON.parse(Buffer.concat(parts).toString('utf16le')), hash: hash.digest('hex'),
      importDetails: { mode: 'streamed' as const, inputBytes, retainedBytes, omittedStatusReasons } };
  } finally { source.destroy(); }
}
