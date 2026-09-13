import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const sourceRoot = join(root, 'src');
const indexPath = join(root, 'index.html');

const forbiddenSourcePatterns = [
  { label: 'eval()', pattern: /\beval\s*\(/ },
  { label: 'new Function()', pattern: /\bnew\s+Function\s*\(/ },
  { label: 'document.write()', pattern: /\bdocument\s*\.\s*write\s*\(/ },
  { label: 'javascript: URL', pattern: /javascript\s*:/i },
];

const requiredCspDirectives = [
  "default-src 'self'",
  "script-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectSourceFiles(fullPath));
      continue;
    }

    if (['.ts', '.js', '.html'].includes(extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function lineNumberForOffset(content, offset) {
  return content.slice(0, offset).split('\n').length;
}

function recordMatches(violations, filePath, content, checks) {
  for (const { label, pattern } of checks) {
    const match = pattern.exec(content);
    if (match) {
      violations.push(`${relative(root, filePath)}:${lineNumberForOffset(content, match.index)} contains forbidden ${label}`);
    }
  }
}

async function main() {
  const violations = [];
  const sourceFiles = await collectSourceFiles(sourceRoot);

  for (const filePath of sourceFiles) {
    const content = await readFile(filePath, 'utf8');
    recordMatches(violations, filePath, content, forbiddenSourcePatterns);
  }

  const indexHtml = await readFile(indexPath, 'utf8');
  recordMatches(violations, indexPath, indexHtml, forbiddenSourcePatterns);

  const cspMatch = indexHtml.match(/<meta\s+http-equiv=["']Content-Security-Policy["']\s+content=(["'])([\s\S]*?)\1\s*\/?\s*>/i);
  if (!cspMatch) {
    violations.push('index.html is missing a Content-Security-Policy meta tag');
  } else {
    const csp = cspMatch[2];
    for (const directive of requiredCspDirectives) {
      if (!csp.includes(directive)) {
        violations.push(`index.html CSP is missing: ${directive}`);
      }
    }
    if (csp.includes("'unsafe-eval'")) {
      violations.push("index.html CSP must not allow 'unsafe-eval'");
    }
  }

  if (!/<meta\s+name=["']referrer["']\s+content=["']strict-origin-when-cross-origin["']\s*\/?\s*>/i.test(indexHtml)) {
    violations.push('index.html must use strict-origin-when-cross-origin referrer policy');
  }

  const inlineScript = /<script(?![^>]*\bsrc\s*=)[^>]*>[\s\S]*?<\/script>/i.exec(indexHtml);
  if (inlineScript) {
    violations.push(`index.html:${lineNumberForOffset(indexHtml, inlineScript.index)} contains an inline script; keep executable code in modules covered by script-src 'self'`);
  }

  const inlineHandler = /\son[a-z]+\s*=/i.exec(indexHtml);
  if (inlineHandler) {
    violations.push(`index.html:${lineNumberForOffset(indexHtml, inlineHandler.index)} contains an inline event handler`);
  }

  if (violations.length > 0) {
    console.error('Security checks failed:\n');
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Security checks passed for ${sourceFiles.length} source files plus index.html.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
