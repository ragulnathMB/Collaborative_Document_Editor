import { OpComponent, Operation } from "../../types";

// Client-side mirror of the server's OT engine. Must stay algorithmically
// identical to server/src/collaboration/ot.ts so both sides converge.

export function applyOperation(content: string, op: Operation): string {
  let result = "";
  let index = 0;

  for (const component of op.ops) {
    if (component.type === "retain") {
      result += content.slice(index, index + component.count);
      index += component.count;
    } else if (component.type === "insert") {
      result += component.text;
    } else if (component.type === "delete") {
      index += component.count;
    }
  }

  result += content.slice(index);
  return result;
}

export function transform(opA: Operation, opB: Operation): Operation {
  const transformedOps: OpComponent[] = [];
  const aOps = [...opA.ops];
  const bOps = [...opB.ops];
  let aIdx = 0;
  let bIdx = 0;
  let a = aOps[aIdx];
  let b = bOps[bIdx];

  while (a || b) {
    if (b && b.type === "insert") {
      transformedOps.push({ type: "retain", count: b.text.length });
      bIdx++;
      b = bOps[bIdx];
      continue;
    }
    if (a && a.type === "insert") {
      transformedOps.push({ type: "insert", text: a.text });
      aIdx++;
      a = aOps[aIdx];
      continue;
    }
    if (!a || !b) {
      if (a) {
        transformedOps.push(a);
        aIdx++;
        a = aOps[aIdx];
      } else if (b) {
        bIdx++;
        b = bOps[bIdx];
      }
      continue;
    }

    const aCount = a.type === "retain" || a.type === "delete" ? a.count : 0;
    const bCount = b.type === "retain" || b.type === "delete" ? b.count : 0;
    const minCount = Math.min(aCount, bCount);

    if (a.type === "retain" && b.type === "retain") {
      transformedOps.push({ type: "retain", count: minCount });
    } else if (a.type === "delete" && b.type === "retain") {
      transformedOps.push({ type: "delete", count: minCount });
    }

    if (minCount >= aCount) {
      aIdx++;
      a = aOps[aIdx];
    } else if (a) {
      a = { ...a, count: aCount - minCount } as OpComponent;
    }

    if (minCount >= bCount) {
      bIdx++;
      b = bOps[bIdx];
    } else if (b) {
      b = { ...b, count: bCount - minCount } as OpComponent;
    }
  }

  return {
    ops: mergeRetains(transformedOps),
    baseVersion: opA.baseVersion + 1,
    userId: opA.userId,
    clientId: opA.clientId,
  };
}

function mergeRetains(ops: OpComponent[]): OpComponent[] {
  const merged: OpComponent[] = [];
  for (const op of ops) {
    const last = merged[merged.length - 1];
    if (last && last.type === "retain" && op.type === "retain") {
      last.count += op.count;
    } else if (op.type === "retain" && op.count === 0) {
      continue;
    } else {
      merged.push({ ...op });
    }
  }
  return merged;
}

// Diff two strings into a minimal Operation (naive common-prefix/suffix
// diff — sufficient for single-keystroke and paste-sized edits typed
// in a textarea; not a full Myers diff).
export function diffToOperation(
  oldText: string,
  newText: string,
  baseVersion: number,
  userId: string,
  clientId: string
): Operation {
  let prefixLen = 0;
  const maxPrefix = Math.min(oldText.length, newText.length);
  while (prefixLen < maxPrefix && oldText[prefixLen] === newText[prefixLen]) {
    prefixLen++;
  }

  let suffixLen = 0;
  const maxSuffix = Math.min(oldText.length, newText.length) - prefixLen;
  while (
    suffixLen < maxSuffix &&
    oldText[oldText.length - 1 - suffixLen] === newText[newText.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const deletedCount = oldText.length - prefixLen - suffixLen;
  const insertedText = newText.slice(prefixLen, newText.length - suffixLen);

  const ops: OpComponent[] = [];
  if (prefixLen > 0) ops.push({ type: "retain", count: prefixLen });
  if (deletedCount > 0) ops.push({ type: "delete", count: deletedCount });
  if (insertedText.length > 0) ops.push({ type: "insert", text: insertedText });
  if (suffixLen > 0) ops.push({ type: "retain", count: suffixLen });

  return { ops, baseVersion, userId, clientId };
}
