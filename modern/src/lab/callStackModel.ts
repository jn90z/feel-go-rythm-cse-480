export type RecursiveExample = "fibonacci" | "factorial";

export type CallEventKind = "enter" | "base" | "return";

export interface CallStackEvent {
  kind: CallEventKind;
  functionName: string;
  argument: number;
  depth: number;
  stack: string[];
  value?: number;
  explanation: string;
}

export interface CallStackTrace {
  example: RecursiveExample;
  input: number;
  result: number;
  calls: number;
  maxDepth: number;
  events: CallStackEvent[];
}

function frame(functionName: string, argument: number): string {
  return `${functionName}(${argument})`;
}

export function buildCallStackTrace(example: RecursiveExample, input: number): CallStackTrace {
  const safeInput = Math.max(0, Math.floor(input));
  const events: CallStackEvent[] = [];
  const stack: string[] = [];
  let calls = 0;
  let maxDepth = 0;

  const record = (
    kind: CallEventKind,
    functionName: string,
    argument: number,
    explanation: string,
    value?: number,
  ) => {
    events.push({
      kind,
      functionName,
      argument,
      depth: stack.length,
      stack: [...stack],
      value,
      explanation,
    });
  };

  const fibonacci = (n: number): number => {
    const name = "fib";
    stack.push(frame(name, n));
    calls++;
    maxDepth = Math.max(maxDepth, stack.length);
    record("enter", name, n, `Call fib(${n}) and push a new stack frame.`);

    if (n < 2) {
      record("base", name, n, `Base case: fib(${n}) returns ${n} without making more calls.`, n);
      stack.pop();
      return n;
    }

    const left = fibonacci(n - 1);
    const right = fibonacci(n - 2);
    const value = left + right;
    record("return", name, n, `Both child calls finished, so ${left} + ${right} = ${value}. Return ${value} and pop fib(${n}).`, value);
    stack.pop();
    return value;
  };

  const factorial = (n: number): number => {
    const name = "fact";
    stack.push(frame(name, n));
    calls++;
    maxDepth = Math.max(maxDepth, stack.length);
    record("enter", name, n, `Call fact(${n}) and push a new stack frame.`);

    if (n <= 1) {
      record("base", name, n, `Base case: fact(${n}) returns 1.`, 1);
      stack.pop();
      return 1;
    }

    const child = factorial(n - 1);
    const value = n * child;
    record("return", name, n, `The recursive call returned ${child}, so ${n} × ${child} = ${value}. Return ${value} and pop fact(${n}).`, value);
    stack.pop();
    return value;
  };

  const result = example === "fibonacci" ? fibonacci(safeInput) : factorial(safeInput);

  return {
    example,
    input: safeInput,
    result,
    calls,
    maxDepth,
    events,
  };
}
