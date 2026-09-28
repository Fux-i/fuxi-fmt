import { build } from 'esbuild';

await build({
  entryPoints: ['src/extension.ts'],
  // .cjs, because the package is "type": "module" but the extension host is
  // happier with CommonJS for a bundled extension.
  outfile: 'dist/extension.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  external: ['vscode'],
  sourcemap: true,
  logLevel: 'info',
});
