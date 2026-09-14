export type SourceSiliconStageId = "source" | "tokens" | "ast" | "ir" | "assembly" | "registers" | "address" | "memory";

export interface SourceSiliconStage {
  id: SourceSiliconStageId;
  title: string;
  code: string;
  explanation: string;
}

export interface SourceSiliconTrace {
  index: number;
  elementSize: number;
  baseAddress: number;
  effectiveAddress: number;
  registers: Record<string, string>;
  stages: SourceSiliconStage[];
}

const MIN_INDEX = 0;
const MAX_INDEX = 15;
const ELEMENT_SIZE = 4;
const DEFAULT_BASE = 0x1000;

export function clampTraceIndex(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_INDEX, Math.max(MIN_INDEX, Math.trunc(value)));
}

export function buildSourceSiliconTrace(indexInput: number, baseAddress = DEFAULT_BASE): SourceSiliconTrace {
  const index = clampTraceIndex(indexInput);
  const safeBase = Number.isFinite(baseAddress) ? Math.max(0, Math.trunc(baseAddress)) : DEFAULT_BASE;
  const effectiveAddress = safeBase + index * ELEMENT_SIZE;
  const hex = (value: number) => `0x${value.toString(16).padStart(4, "0")}`;
  const registers = {
    rdi: hex(safeBase),
    rsi: String(index),
    eax: "total",
    edx: `values[${index}]`
  };

  const stages: SourceSiliconStage[] = [
    {
      id: "source",
      title: "1 · C++ source",
      code: `total += values[${index}];`,
      explanation: "The programmer describes intent using an array index. No physical address is written in the source code."
    },
    {
      id: "tokens",
      title: "2 · Tokens",
      code: `identifier(total)  +=  identifier(values)  [  integer(${index})  ]  ;`,
      explanation: "The lexer turns characters into tokens the parser can reason about."
    },
    {
      id: "ast",
      title: "3 · AST",
      code: `AddAssign\n├─ total\n└─ Subscript(values, ${index})`,
      explanation: "The parser builds structure: an add-assignment whose right side is an array subscript."
    },
    {
      id: "ir",
      title: "4 · Simplified IR",
      code: `%addr = values + ${index} * 4\n%v = load i32, %addr\n%total2 = add %total, %v`,
      explanation: "Compiler IR makes the data flow explicit while remaining independent of one exact machine instruction encoding."
    },
    {
      id: "assembly",
      title: "5 · x86-64 idea",
      code: `mov edx, DWORD PTR [rdi + rsi*4]\nadd eax, edx`,
      explanation: "A scaled-index addressing mode can combine base pointer, index, and 4-byte element size directly in a load."
    },
    {
      id: "registers",
      title: "6 · Registers",
      code: `RDI=${registers.rdi}   RSI=${registers.rsi}\nEAX=${registers.eax}   EDX←${registers.edx}`,
      explanation: "Registers hold the base pointer, array index, running total, and loaded value while the instruction executes."
    },
    {
      id: "address",
      title: "7 · Effective address",
      code: `${hex(safeBase)} + ${index} × ${ELEMENT_SIZE} = ${hex(effectiveAddress)}`,
      explanation: "The CPU address-generation hardware computes the byte address of the selected int element."
    },
    {
      id: "memory",
      title: "8 · Memory handoff",
      code: `load 4 bytes from ${hex(effectiveAddress)} → EDX`,
      explanation: "This effective address is where the compiler/runtime story hands off to virtual memory, the TLB, caches, and physical memory."
    }
  ];

  return { index, elementSize: ELEMENT_SIZE, baseAddress: safeBase, effectiveAddress, registers, stages };
}

export const SOURCE_SILICON_MAX_INDEX = MAX_INDEX;
