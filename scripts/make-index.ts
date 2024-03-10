#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

const INDEX_FILE_NAME = 'index.ts';

const makeIndex = async (directory: string) => {
  const dirPath = path.join(__dirname, '..', directory);
  console.log(`Making index file in: ${directory}`);

  const files = fs.readdirSync(dirPath).filter((file) => file !== INDEX_FILE_NAME);
  console.log(`Found ${files.length} files`);

  if (!files.length) return;

  const indexFileContent = files
    .map((file) => `export * from './${file.replace(/\.ts$/g, '')}';`)
    .join('\n');

  const indexPath = path.join(__dirname, '..', directory, INDEX_FILE_NAME);
  console.log(`Writing to: ${directory}/index.ts`);

  fs.writeFileSync(indexPath, indexFileContent.concat('\n'), { flag: 'w' });
};

const paths = [
  'libs/entities/src',
  'libs/repositories/src',
  'apps/service-auth/src/auth/dto',
  'apps/service-auth/src/guilds/dto',
  'apps/service-auth/src/clans/dto',
  'apps/service-auth/src/links/dto',
  'apps/service-auth/src/players/dto',
];

(async () => {
  for (const path of paths) await makeIndex(path);
})();
