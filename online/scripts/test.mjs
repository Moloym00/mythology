import ts from 'typescript';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
// 使用工程已有 TypeScript，无需新增测试框架。
for (const name of [
  'game/config',
  'game/content',
  'game/engine',
  'game/ai',
  'game/feedback',
  'rooms',
]) {
  const source = await readFile(`lib/${name}.ts`, 'utf8');
  const output = ts
    .transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
      },
    })
    .outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'");
  const destination = `work/tests/${name}.js`;
  await mkdir(destination.slice(0, destination.lastIndexOf('/')), {
    recursive: true,
  });
  await writeFile(destination, output);
}
await import('../tests/engine.test.mjs');
await import('../tests/ai.test.mjs');

await import('../tests/feedback.test.mjs');
