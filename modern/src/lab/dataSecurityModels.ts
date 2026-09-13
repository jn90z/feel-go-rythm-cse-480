export interface CompressionToken {
  symbol: string;
  count: number;
}

export interface CompressionResult {
  input: string;
  tokens: CompressionToken[];
  encoded: string;
  decoded: string;
  inputBytes: number;
  encodedBytes: number;
  reversible: boolean;
}

export type SecurityStageKind = "public" | "secret" | "protected" | "metadata";

export interface SecurityStage {
  title: string;
  detail: string;
  kind: SecurityStageKind;
}

export interface VisibilityRow {
  observer: string;
  canSee: string;
  cannotSee: string;
}

const MAX_TEXT = 160;

export function clampLearningText(value: string): string {
  return value.slice(0, MAX_TEXT);
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function runLengthEncode(value: string): CompressionResult {
  const input = clampLearningText(value);
  const tokens: CompressionToken[] = [];
  for (const symbol of input) {
    const last = tokens.at(-1);
    if (last?.symbol === symbol) last.count += 1;
    else tokens.push({ symbol, count: 1 });
  }

  const encoded = tokens.map(token => `${token.count}:${token.symbol.codePointAt(0) ?? 0}`).join("|");
  const decoded = tokens.map(token => token.symbol.repeat(token.count)).join("");
  return {
    input,
    tokens,
    encoded,
    decoded,
    inputBytes: byteLength(input),
    encodedBytes: byteLength(encoded),
    reversible: decoded === input
  };
}

export function zipPipelineStages(): SecurityStage[] {
  return [
    { title: "Collect files", detail: "ZIP stores one or more files plus names, timestamps, sizes, and checksums in an archive container.", kind: "metadata" },
    { title: "Find repetition", detail: "A common ZIP method, DEFLATE, uses LZ77-style back-references so repeated byte sequences can be represented by distance/length references.", kind: "public" },
    { title: "Shorten common patterns", detail: "DEFLATE then uses Huffman coding so frequently occurring symbols can use shorter bit codes than rare symbols.", kind: "public" },
    { title: "Write compressed data", detail: "The compressed byte streams are stored in the ZIP archive. Already-compressed media may shrink very little or even grow slightly.", kind: "protected" },
    { title: "Store directory metadata", detail: "The central directory lets software find each file, its compression method, offsets, sizes, and integrity information.", kind: "metadata" },
    { title: "Decompress reversibly", detail: "Extraction reverses the coding and references to reproduce the original bytes exactly. Lossless compression must round-trip perfectly.", kind: "secret" }
  ];
}

export function encryptionHandshakeStages(): SecurityStage[] {
  return [
    { title: "Server proves identity", detail: "The server sends a certificate that binds its identity to a public key. The public key is safe to share; the private key remains secret.", kind: "public" },
    { title: "Client validates certificate", detail: "The client checks the certificate chain, hostname, validity, and signatures before trusting the server identity.", kind: "metadata" },
    { title: "Exchange ephemeral public values", detail: "Modern TLS commonly uses ephemeral Diffie–Hellman key agreement. Each side sends a public value while keeping its private value secret.", kind: "public" },
    { title: "Derive shared session secrets", detail: "Both sides combine their private value with the peer's public value and derive matching session keys without sending those session keys directly.", kind: "secret" },
    { title: "Encrypt application data", detail: "Fast symmetric authenticated encryption protects the actual web traffic using the derived session keys.", kind: "protected" },
    { title: "Authenticate every record", detail: "Authenticated encryption also detects tampering. Modified ciphertext fails verification instead of silently becoming trusted plaintext.", kind: "protected" }
  ];
}

export function encryptionVisibility(): VisibilityRow[] {
  return [
    { observer: "Client", canSee: "Plaintext, server identity, session state", cannotSee: "Server private key" },
    { observer: "Network observer", canSee: "IP routing metadata, packet sizes/timing, encrypted bytes", cannotSee: "Protected application plaintext" },
    { observer: "Server", canSee: "Plaintext after decryption, client network address", cannotSee: "Client device secrets unrelated to the session" }
  ];
}

export function vpnTunnelStages(): SecurityStage[] {
  return [
    { title: "Create inner packet", detail: "An application creates ordinary traffic for the destination. This is the inner packet the VPN intends to carry.", kind: "public" },
    { title: "Encrypt and authenticate", detail: "The VPN client protects the inner packet with tunnel keys so intermediaries cannot read or alter its protected contents undetected.", kind: "protected" },
    { title: "Add outer routing header", detail: "A new outer packet routes from your device to the VPN gateway. The outer source/destination must remain visible so the Internet can deliver the tunnel packet.", kind: "metadata" },
    { title: "Traverse ISP / local network", detail: "The access network can see traffic going to a VPN gateway plus sizes and timing, but not the encrypted inner packet contents.", kind: "protected" },
    { title: "VPN gateway unwraps tunnel", detail: "The gateway verifies and decrypts the tunnel, recovering the original inner packet.", kind: "secret" },
    { title: "Forward toward destination", detail: "The gateway forwards traffic onward. To the destination, the apparent network source is typically the VPN gateway rather than the user's access-network address.", kind: "public" },
    { title: "Return through tunnel", detail: "Replies travel back to the VPN gateway, are protected into the tunnel, routed to the client, and then decrypted locally.", kind: "protected" }
  ];
}

export function vpnVisibility(): VisibilityRow[] {
  return [
    { observer: "Local network / ISP", canSee: "Connection to VPN gateway, timing, volume", cannotSee: "Encrypted tunnel payload" },
    { observer: "VPN provider", canSee: "Client tunnel endpoint and traffic leaving its gateway", cannotSee: "End-to-end TLS plaintext when HTTPS is also used" },
    { observer: "Destination site", canSee: "Application traffic it terminates and VPN gateway IP", cannotSee: "User's normal public ISP-facing IP in a typical routed VPN setup" }
  ];
}
