#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

const INDEX_FILE_NAME = 'index.ts';

const makeIndex = (directory: string) => {
  const dirPath = path.join(__dirname, '..', directory);
  console.log(`Making index file in: ${directory}`);

  const files = fs
    .readdirSync(dirPath)
    .filter((file) => file !== INDEX_FILE_NAME && !file.endsWith('.json'));
  console.log(`Found ${files.length} files`);

  if (!files.length) return;

  const indexFileContent = files
    .map((file) => `export * from './${file.replace(/\.ts$/g, '')}';`)
    .join('\n');

  const indexPath = path.join(__dirname, '..', directory, INDEX_FILE_NAME);
  console.log(`Writing to: ${directory}/index.ts`);

  fs.writeFileSync(indexPath, indexFileContent.concat('\n'), { flag: 'w' });
};

const findIndexFiles = (dir: string, basePath: string): string[] => {
  const indexPaths: string[] = [];

  const items = fs.readdirSync(dir, { withFileTypes: true });

  const hasIndexFile = items.some((item) => item.isFile() && item.name === INDEX_FILE_NAME);

  if (hasIndexFile) {
    const relativePath = path.relative(basePath, dir);
    indexPaths.push(relativePath || '.');
  }

  for (const item of items) {
    if (item.isDirectory()) {
      const subDir = path.join(dir, item.name);
      indexPaths.push(...findIndexFiles(subDir, basePath));
    }
  }

  return indexPaths;
};

const findAllIndexPaths = (baseDir: string = 'src'): string[] => {
  const projectRoot = path.join(__dirname, '..');
  const searchDir = path.join(projectRoot, baseDir);

  if (!fs.existsSync(searchDir)) {
    return [];
  }

  const indexPaths = findIndexFiles(searchDir, searchDir);

  return indexPaths.map((p) => path.join(baseDir, p));
};

for (const path of [...findAllIndexPaths('src'), ...findAllIndexPaths('libs')]) makeIndex(path);
