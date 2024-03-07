#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import yargs from 'yargs';

const INDEX_FILE_NAME = 'index.ts';

const argv = yargs(process.argv.slice(2))
  .scriptName('make-index')
  .option('d', {
    alias: 'directory',
    demandOption: true,
    describe: 'Directory to make an index in',
    type: 'string',
  })
  .help().argv;

const main = (): void => {
  if ('then' in argv) {
    throw new Error('Expected argv to be an object but got Promise instead, exiting');
  }

  const dirPath = path.join(__dirname, '..', argv.d);
  console.log(`Making index file in: ${dirPath}`);

  const files = fs.readdirSync(dirPath).filter((f) => f !== INDEX_FILE_NAME);
  console.log(`Found ${files.length} files`);

  const indexFileContent = files
    .map((file) => `export * from './${file.replace(/\.ts$/g, '')}';`)
    .join('\n')
    .concat('\n');

  const indexPath = path.join(__dirname, '..', argv.d, INDEX_FILE_NAME);
  console.log(`Writing to: ${indexPath}`);

  fs.writeFileSync(indexPath, indexFileContent, { flag: 'w' });
  console.log('Successfully updated');
};

main();
