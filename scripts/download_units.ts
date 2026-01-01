import { writeFileSync } from 'node:fs';

async function main() {
  const result = await fetch(
    'https://raw.githubusercontent.com/clashperk/clashperk/refs/heads/main/scripts/assets/troops_export.json',
  ).then((res) => res.json());

  writeFileSync('./libs/clash-client/src/troops.json', JSON.stringify(result, null, 2));
}

main().catch(console.error);
