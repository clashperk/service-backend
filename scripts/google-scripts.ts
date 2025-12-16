import 'dotenv/config';

import { auth as _auth } from '@googleapis/oauth2';
import { script as _script } from '@googleapis/script';
import fs from 'node:fs';

function authorize() {
  const credentials = JSON.parse(fs.readFileSync(__dirname + '/authorized_tokens.json', 'utf8'));

  const client = new _auth.OAuth2();
  client.setCredentials(credentials);

  return client;
}

async function attachScriptToSheet(spreadsheetId, scriptTitle) {
  const scriptService = _script({ version: 'v1', auth: authorize() });

  try {
    console.log(`Creating script "${scriptTitle}" attached to Sheet: ${spreadsheetId}...`);

    const createResponse = await scriptService.projects.create({
      requestBody: {
        title: scriptTitle,
        parentId: spreadsheetId,
      },
    });

    const scriptId = createResponse.data.scriptId;
    console.log(`Script created! Script ID: ${scriptId}`);
    console.log(`URL: ${createResponse.data.scriptId}`);
    console.log('Uploading code files...');

    await scriptService.projects.updateContent({
      scriptId: scriptId!,
      requestBody: {
        files: [
          {
            name: 'appsscript', // The manifest file
            type: 'JSON',
            source: JSON.stringify({
              timeZone: 'America/New_York',
              dependencies: {},
              exceptionLogging: 'CLOUD',
            }),
          },
          {
            name: 'Code', // Your main script file
            type: 'SERVER_JS',
            source: `
              function onOpen() {
                SpreadsheetApp.getUi()
                  .createMenu('Custom Menu')
                  .addItem('Hello', 'sayHello')
                  .addToUi();
              }

              function sayHello() {
                Browser.msgBox('Hello from Node.js attached script!');
              }
            `,
          },
        ],
      },
    });

    console.log('Code uploaded successfully.');
    return scriptId;
  } catch (error) {
    console.error('Error attaching script:', error.message);
    if (error.response) console.error(error.response.data);
  }
}

const TARGET_SHEET_ID = '1GAbJ5m_jnimFr2bi7VS65Dthb7mYV7h2BztRun1gPak';
attachScriptToSheet(TARGET_SHEET_ID, 'My Node Attached Script').catch(console.error);
