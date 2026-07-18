import { OpComponent, Operation } from "./operation.types";

// Core OT engine: applies operations to text and transforms concurrent
// operations against each other so both converge to the same final state
// (Convergence property in the CC1/CC2 sense of Ellis & Gibbs OT model).

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

  // Any remaining untouched tail
  result += content.slice(index);
  return result;
}

// Transform opA against opB, assuming both were generated from the same
// base document version. Returns opA' such that applying opB then opA'
// yields the same result as applying opA then transform(opB, opA).
// This is a simplified single-insert/delete-per-op transform sufficient
// for a single flat text buffer (character-level OT, à la Google Wave).
export function transform(opA: Operation, opB: Operation): Operation {
  const transformedOps: OpComponent[] = [];

  let aOps = [...opA.ops];
  let bOps = [...opB.ops];

  let aIdx = 0;
  let bIdx = 0;

  let a = aOps[aIdx];
  let b = bOps[bIdx];

  while (a || b) {
    // opB inserted text: opA must retain over it (priority: opB goes first,
    // tie-broken by clientId to keep transforms deterministic)
    if (b && b.type === "insert") {
      transformedOps.push({ type: "retain", count: b.text.length });
      bIdx++;
      b = bOps[bIdx];
      continue;
    }

    // opA inserts its own text — passes through unchanged
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
        // opB retain/delete with no corresponding opA component: nothing to add
        bIdx++;
        b = bOps[bIdx];
      }
      continue;
    }

    const aCount = a.type === "retain" ? a.count : a.type === "delete" ? a.count : 0;
    const bCount = b.type === "retain" ? b.count : b.type === "delete" ? b.count : 0;
    const minCount = Math.min(aCount, bCount);

    if (a.type === "retain" && b.type === "retain") {
      transformedOps.push({ type: "retain", count: minCount });
    } else if (a.type === "delete" && b.type === "retain") {
      transformedOps.push({ type: "delete", count: minCount });
    } else if (a.type === "retain" && b.type === "delete") {
      // opB deleted this range: opA should not retain characters that no longer exist
    } else if (a.type === "delete" && b.type === "delete") {
      // Both deleted the same range: no-op needed on opA's side, already gone
    }

    consume(a, minCount, aCount, () => {
      aIdx++;
      a = aOps[aIdx];
    }, (remaining) => (a = { ...a!, count: remaining } as OpComponent));

    consume(b, minCount, bCount, () => {
      bIdx++;
      b = bOps[bIdx];
    }, (remaining) => (b = { ...b!, count: remaining } as OpComponent));
  }

  return {
    ops: mergeRetains(transformedOps),
    baseVersion: opA.baseVersion + 1,
    userId: opA.userId,
    clientId: opA.clientId,
  };
}

function consume(
  component: OpComponent | undefined,
  used: number,
  total: number,
  advance: () => void,
  shrink: (remaining: number) => void
) {
  if (!component || component.type === "insert") return;
  if (used >= total) {
    advance();
  } else {
    shrink(total - used);
  }
}

// Collapse adjacent retain components produced by the transform loop
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
