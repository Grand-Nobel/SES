import { generate } from 'openapi-typescript-codegen';
import fs from 'fs';

generate({
  input: './openapi.json',
  output: './generated/api',
  useUnionTypes: true,
}).then(() => {
  fs.writeFileSync('generated/api/index.ts', `
    export * from './api';
    export * from './hooks';
  `);
});
