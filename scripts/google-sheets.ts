import { auth as _auth } from '@googleapis/oauth2';
import { sheets as _sheets } from '@googleapis/sheets';
import fs from 'node:fs';

function authorize() {
  const oauth2 = JSON.parse(fs.readFileSync(__dirname + '/oauth2_keys.json', 'utf8'));
  const credentials = JSON.parse(fs.readFileSync(__dirname + '/authorized_tokens.json', 'utf8'));

  const client = new _auth.OAuth2({
    client_secret: oauth2.client_secret,
    client_id: oauth2.client_id,
  });
  client.setCredentials({ refresh_token: credentials.refresh_token });

  return client;
}

async function listMajors() {
  const oauth = authorize();

  const sheets = _sheets({
    version: 'v4',
    auth: oauth,
  });

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
    range: 'Class Data!A2:E',
  });

  const rows = result.data.values;

  if (!rows || rows.length === 0) {
    console.log('No data found.');
    return;
  }

  console.log('Name, Major');
  rows.forEach((row) => {
    console.log(`${row[0]}, ${row[4]}`);
  });
}

listMajors().catch(console.error);
