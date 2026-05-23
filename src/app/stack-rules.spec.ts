import * as fs from 'node:fs';
import * as path from 'node:path';

// Static stack-rule lint test. Walks `src/app/**/*.ts` and `src/app/**/*.html`
// and fails on:
// - Any TypeScript file that uses `@NgModule(`.
// - A component decorator that explicitly sets `standalone: false`
//   (`standalone: true` is also discouraged in Angular 22 because it's the
//   default, but only `standalone: false` is the active violation).
// - A component decorator missing `changeDetection: ChangeDetectionStrategy.OnPush`.
// - A template (external `.html` or inline `template:` string) that uses
//   `*ngIf`, `*ngFor`, or `*ngSwitch`.
//
// `*.spec.ts` files are skipped so they can reference these strings as data.

const APP_ROOT = path.resolve(__dirname, '..', 'app');

function* walk(root: string): Generator<string> {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

interface ScannedFiles {
  readonly tsFiles: readonly string[];
  readonly htmlFiles: readonly string[];
}

function collectFiles(): ScannedFiles {
  const tsFiles: string[] = [];
  const htmlFiles: string[] = [];
  for (const filePath of walk(APP_ROOT)) {
    if (filePath.endsWith('.ts') && !filePath.endsWith('.spec.ts')) {
      tsFiles.push(filePath);
    } else if (filePath.endsWith('.html')) {
      htmlFiles.push(filePath);
    }
  }
  return { tsFiles, htmlFiles };
}

/**
 * Extract every `@Component({ ... })` decorator block via brace-counting
 * scan starting at `@Component(`, so nested object literals (e.g. `host: {…}`)
 * don't terminate the block early.
 */
function extractComponentDecoratorBlocks(source: string): string[] {
  const blocks: string[] = [];
  const marker = '@Component(';
  let searchFrom = 0;
  while (true) {
    const start = source.indexOf(marker, searchFrom);
    if (start === -1) break;
    const openParen = start + marker.length - 1;
    let i = openParen;
    let depth = 0;
    for (; i < source.length; i++) {
      const ch = source[i];
      if (ch === '(' || ch === '{' || ch === '[') {
        depth++;
      } else if (ch === ')' || ch === '}' || ch === ']') {
        depth--;
        if (depth === 0) {
          break;
        }
      }
    }
    if (i < source.length) {
      blocks.push(source.slice(start, i + 1));
      searchFrom = i + 1;
    } else {
      break;
    }
  }
  return blocks;
}

/**
 * Pull the contents of every `template: \`…\`` string in a `@Component({…})`
 * decorator block. Embedded `${…}` expressions are tolerated as raw text.
 */
function extractInlineTemplates(decoratorBlock: string): string[] {
  const templates: string[] = [];
  const marker = 'template:';
  let searchFrom = 0;
  while (true) {
    const idx = decoratorBlock.indexOf(marker, searchFrom);
    if (idx === -1) break;
    let i = idx + marker.length;
    while (i < decoratorBlock.length && /\s/.test(decoratorBlock[i])) {
      i++;
    }
    if (decoratorBlock[i] !== '`') {
      // Not a backtick string (e.g. `templateUrl:` lookalike); skip.
      searchFrom = idx + marker.length;
      continue;
    }
    const start = i + 1;
    let end = -1;
    for (let j = start; j < decoratorBlock.length; j++) {
      const ch = decoratorBlock[j];
      if (ch === '\\') {
        j++;
        continue;
      }
      if (ch === '`') {
        end = j;
        break;
      }
    }
    if (end === -1) break;
    templates.push(decoratorBlock.slice(start, end));
    searchFrom = end + 1;
  }
  return templates;
}

function resolveExternalTemplatePath(decoratorBlock: string, ownerFile: string): string | null {
  const match = decoratorBlock.match(/templateUrl:\s*['"]([^'"]+)['"]/);
  if (!match) return null;
  return path.resolve(path.dirname(ownerFile), match[1]);
}

const LEGACY_CONTROL_FLOW = /\*ng(If|For|Switch)\b/;

describe('Stack rules — Angular 22 conventions enforced statically', () => {
  const { tsFiles, htmlFiles } = collectFiles();

  it('finds source files to scan', () => {
    expect(tsFiles.length).toBeGreaterThan(0);
  });

  it('no TypeScript file under src/app uses @NgModule (Requirement 8.6)', () => {
    const offenders: string[] = [];
    for (const file of tsFiles) {
      const source = fs.readFileSync(file, 'utf8');
      if (source.includes('@NgModule(')) {
        offenders.push(file);
      }
    }
    if (offenders.length > 0) {
      throw new Error(
        `Found @NgModule(...) in non-spec TS files (forbidden by Requirement 8.6):\n` +
          offenders.map((f) => `  - ${path.relative(APP_ROOT, f)}`).join('\n'),
      );
    }
  });

  it('every @Component decorator omits standalone:false (Requirement 8.2)', () => {
    const offenders: { file: string; reason: string }[] = [];
    for (const file of tsFiles) {
      const source = fs.readFileSync(file, 'utf8');
      const blocks = extractComponentDecoratorBlocks(source);
      for (const block of blocks) {
        if (/standalone\s*:\s*false/.test(block)) {
          offenders.push({
            file,
            reason: 'sets standalone: false; Angular 22 requires standalone components',
          });
        }
      }
    }
    if (offenders.length > 0) {
      throw new Error(
        `Standalone violation (Requirement 8.2):\n` +
          offenders.map((o) => `  - ${path.relative(APP_ROOT, o.file)}: ${o.reason}`).join('\n'),
      );
    }
  });

  it('every @Component decorator sets changeDetection: ChangeDetectionStrategy.OnPush (Requirement 8.3)', () => {
    const offenders: string[] = [];
    for (const file of tsFiles) {
      const source = fs.readFileSync(file, 'utf8');
      const blocks = extractComponentDecoratorBlocks(source);
      for (const block of blocks) {
        if (!/changeDetection\s*:\s*ChangeDetectionStrategy\.OnPush/.test(block)) {
          offenders.push(file);
        }
      }
    }
    if (offenders.length > 0) {
      throw new Error(
        `OnPush violation (Requirement 8.3): the following files have a @Component decorator that does not set ` +
          `changeDetection: ChangeDetectionStrategy.OnPush:\n` +
          offenders.map((f) => `  - ${path.relative(APP_ROOT, f)}`).join('\n'),
      );
    }
  });

  it('no template uses *ngIf/*ngFor/*ngSwitch — use @if/@for/@switch instead (Requirement 8.5)', () => {
    const offenders: { file: string; match: string }[] = [];

    for (const file of htmlFiles) {
      const source = fs.readFileSync(file, 'utf8');
      const match = source.match(LEGACY_CONTROL_FLOW);
      if (match) {
        offenders.push({ file, match: match[0] });
      }
    }

    for (const file of tsFiles) {
      const source = fs.readFileSync(file, 'utf8');
      const blocks = extractComponentDecoratorBlocks(source);
      for (const block of blocks) {
        for (const inline of extractInlineTemplates(block)) {
          const match = inline.match(LEGACY_CONTROL_FLOW);
          if (match) {
            offenders.push({ file, match: match[0] });
          }
        }

        const externalPath = resolveExternalTemplatePath(block, file);
        if (externalPath && fs.existsSync(externalPath)) {
          const externalSource = fs.readFileSync(externalPath, 'utf8');
          const match = externalSource.match(LEGACY_CONTROL_FLOW);
          if (match) {
            offenders.push({ file: externalPath, match: match[0] });
          }
        }
      }
    }

    if (offenders.length > 0) {
      throw new Error(
        `Legacy control-flow directive used (Requirement 8.5): use @if/@for/@switch instead.\n` +
          offenders.map((o) => `  - ${path.relative(APP_ROOT, o.file)}: ${o.match}`).join('\n'),
      );
    }
  });
});
