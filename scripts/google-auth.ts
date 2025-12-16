import { authenticate } from '@google-cloud/local-auth';
import fs from 'node:fs';

const SCOPES = [
  'https://www.googleapis.com/auth/script.projects',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
];

async function authorize() {
  const auth = await authenticate({
    scopes: SCOPES,
    keyfilePath: __dirname + '/oauth2_keys.json',
  });
  fs.writeFileSync(
    __dirname + '/authorized_tokens.json',
    JSON.stringify(auth.credentials, null, 2),
  );
}

authorize().catch(console.error);
