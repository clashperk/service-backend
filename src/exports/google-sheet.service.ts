import { Collections } from '@app/constants';
import { GoogleSheetsEntity, SheetType } from '@app/entities';
import { drive as _drive, drive_v3 } from '@googleapis/drive';
import { auth as _auth } from '@googleapis/oauth2';
import { sheets as _sheet, type sheets_v4 } from '@googleapis/sheets';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type OAuth2Client } from 'google-auth-library';
import { Collection } from 'mongodb';
import { createHash } from 'node:crypto';

const allowedFormulas = ['=HYPERLINK(', '=IMAGE(', '=SUM('];

export type SchemaRequest = sheets_v4.Schema$Request;

const escapeSheetName = (name: string) => {
  return name.replace(/[\*\?\:\[\]\\\/\']/g, '');
};

const dateToSerialDate = (jsDate: Date) => {
  const baseDate = new Date('1899-12-30').getTime();
  const diffDays = (jsDate.getTime() - baseDate) / (24 * 60 * 60 * 1000);
  return diffDays + 1;
};

const getSheetValue = (value?: string | number | boolean | Date | null) => {
  if (typeof value === 'string' && allowedFormulas.some((formula) => value.startsWith(formula))) {
    return { formulaValue: value };
  }

  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') return { numberValue: value };
  if (typeof value === 'boolean') return { boolValue: value };
  if (value instanceof Date) return { numberValue: dateToSerialDate(value) };
  return {};
};

const getUserEnteredFormat = (value?: string | number | boolean | Date | null) => {
  if (value instanceof Date) return { numberFormat: { type: 'DATE_TIME' } };
  if (typeof value === 'string' && allowedFormulas.some((formula) => value.startsWith(formula))) {
    return { hyperlinkDisplayType: 'LINKED' };
  }
  return {};
};

const getConditionalFormatRequests = (sheets: CreateGoogleSheet[]) => {
  const gridStyleRequests: SchemaRequest[] = sheets
    .map((sheet, sheetId) => [
      {
        addConditionalFormatRule: {
          index: 0,
          rule: {
            ranges: [
              {
                sheetId,
                startRowIndex: 1,
                endRowIndex: sheet.rows.length + 1,
              },
            ],
            booleanRule: {
              condition: {
                type: 'CUSTOM_FORMULA',
                values: [
                  {
                    userEnteredValue: '=MOD(ROW(),2)=0',
                  },
                ],
              },
              format: {
                backgroundColor: {
                  red: 1,
                  green: 1,
                  blue: 1,
                },
              },
            },
          },
        },
      },
      {
        addConditionalFormatRule: {
          index: 1,
          rule: {
            ranges: [
              {
                sheetId,
                startRowIndex: 1,
                endRowIndex: sheet.rows.length + 1,
              },
            ],
            booleanRule: {
              condition: {
                type: 'CUSTOM_FORMULA',
                values: [
                  {
                    userEnteredValue: '=MOD(ROW(),2)=1',
                  },
                ],
              },
              format: {
                backgroundColor: {
                  red: 0.9,
                  green: 0.9,
                  blue: 0.9,
                },
              },
            },
          },
        },
      },
    ])
    .flat();

  return gridStyleRequests;
};

const getStyleRequests = (sheets: CreateGoogleSheet[]) => {
  const styleRequests: SchemaRequest[] = sheets
    .map(({ columns }, sheetId) =>
      columns
        .map((column, columnIndex) => [
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: 0,
                startColumnIndex: columnIndex,
                endColumnIndex: columnIndex + 1,
              },
              cell: {
                userEnteredFormat: {
                  horizontalAlignment: column.align,
                },
              },
              fields: 'userEnteredFormat(horizontalAlignment)',
            },
          },
          {
            updateDimensionProperties: {
              range: {
                sheetId,
                startIndex: columnIndex,
                endIndex: columnIndex + 1,
                dimension: 'COLUMNS',
              },
              properties: {
                pixelSize: column.width,
              },
              fields: 'pixelSize',
            },
          },
        ])
        .flat(),
    )
    .flat();

  return styleRequests;
};

const createColumnRequest = (columns: CreateGoogleSheet['columns']) => {
  return {
    values: columns.map((column) => ({
      userEnteredValue: {
        stringValue: column.name,
      },
      userEnteredFormat: {
        wrapStrategy: 'WRAP',
        textFormat: { bold: true },
        verticalAlignment: 'MIDDLE',
      },
    })),
  };
};

export interface CreateGoogleSheet {
  title: string;
  columns: { align: string; width: number; name: string }[];
  rows: (string | number | Date | boolean | undefined | null)[][];
}

@Injectable()
export class GoogleSheetService {
  private auth: OAuth2Client;
  private drive: drive_v3.Drive;
  private sheet: sheets_v4.Sheets;

  public constructor(
    configService: ConfigService,
    @Inject(Collections.GOOGLE_SHEETS)
    private googleSheetsRepository: Collection<GoogleSheetsEntity>,
  ) {
    this.auth = _auth.fromJSON({
      type: 'authorized_user',
      client_id: configService.getOrThrow('GOOGLE_CLIENT_ID'),
      client_secret: configService.getOrThrow('GOOGLE_CLIENT_SECRET'),
      refresh_token: configService.getOrThrow('GOOGLE_REFRESH_TOKEN'),
    }) as OAuth2Client;

    this.drive = _drive({ version: 'v3', auth: this.auth });
    this.sheet = _sheet({ version: 'v4', auth: this.auth });
  }

  public async createGoogleSheet(title: string, sheets: CreateGoogleSheet[]) {
    const spreadsheet = await this.createSheetRequest(title, sheets);
    await Promise.all([
      this.updateGoogleSheet(spreadsheet.spreadsheetId!, sheets, { clear: false, recreate: false }),
      this.publishSheet(spreadsheet.spreadsheetId!),
    ]);
    return {
      spreadsheetId: spreadsheet.spreadsheetId!,
      spreadsheetUrl: spreadsheet.spreadsheetUrl!,
    };
  }

  public async updateGoogleSheet(
    spreadsheetId: string,
    sheets: CreateGoogleSheet[],
    options: { clear: boolean; recreate: boolean },
  ) {
    const replaceSheetRequests: SchemaRequest[] = [];

    if (options.recreate) {
      const { data } = await this.sheet.spreadsheets.get({ spreadsheetId });
      replaceSheetRequests.push(
        ...(data.sheets || []).slice(1).map((_, idx) => ({
          deleteSheet: { sheetId: idx + 1 },
        })),
      );
      replaceSheetRequests.push(
        ...sheets.slice(1).map((sheet, sheetId) => ({
          addSheet: {
            properties: {
              sheetId: sheetId + 1,
              title: escapeSheetName(sheet.title),
              gridProperties: {
                rowCount: Math.max(sheet.rows.length + 1, 25),
                columnCount: Math.max(sheet.columns.length, 15),
                frozenRowCount: sheet.rows.length ? 1 : 0,
              },
            },
          },
        })),
      );

      await this.sheet.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [...replaceSheetRequests],
        },
      });
    }

    const clearSheetRequests: SchemaRequest[] = sheets
      .map((sheet, sheetId) => [
        {
          updateCells: {
            range: {
              sheetId: sheetId,
            },
            fields: 'userEnteredValue',
          },
        },
        {
          updateSheetProperties: {
            properties: {
              sheetId,
              title: sheet.title,
              gridProperties: {
                columnCount: Math.max(sheet.columns.length, 15),
                rowCount: Math.max(sheet.rows.length + 1, 25),
                frozenRowCount: sheet.rows.length ? 1 : 0,
              },
            },
            fields:
              'gridProperties.rowCount,gridProperties.columnCount,gridProperties.frozenRowCount,title',
          },
        },
      ])
      .flat();

    const requests: SchemaRequest[] = sheets.map((sheet, sheetId) => ({
      updateCells: {
        start: {
          sheetId,
          rowIndex: 0,
          columnIndex: 0,
        },
        rows: [
          createColumnRequest(sheet.columns),
          ...sheet.rows.map((values) => ({
            values: values.map((value) => ({
              userEnteredValue: getSheetValue(value),
              userEnteredFormat: getUserEnteredFormat(value),
            })),
          })),
        ],
        fields: '*',
      },
    }));

    await this.sheet.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          ...(options.clear ? clearSheetRequests : []),
          ...requests,
          ...getStyleRequests(sheets),
          ...getConditionalFormatRequests(sheets),
          {
            createDeveloperMetadata: {
              developerMetadata: {
                metadataKey: 'project',
                metadataValue: 'clashperk',
                visibility: 'DOCUMENT',
                location: {
                  spreadsheet: true,
                },
              },
            },
          },
        ],
      },
    });

    return {
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    };
  }

  public async createOrUpdateSheet({
    sheets,
    guildId,
    clans,
    label,
    sheetType,
  }: {
    sheets: CreateGoogleSheet[];
    guildId: string;
    clans: { tag: string }[];
    label: string;
    sheetType: SheetType;
  }) {
    const clanTags = clans.map((clan) => clan.tag);
    const sha = this.createSHA(guildId, clanTags, sheetType);

    const sheet = await this.googleSheetsRepository.findOne({ sha });

    const spreadsheet = sheet
      ? await this.updateGoogleSheet(sheet.spreadsheetId, sheets, { clear: true, recreate: false })
      : await this.createGoogleSheet(`${label}`, sheets);

    await this.googleSheetsRepository.updateOne(
      { sha: this.createSHA(guildId, clanTags, sheetType) },
      {
        $inc: { exported: 1 },
        $set: { updatedAt: new Date() },
        $setOnInsert: {
          guildId,
          clanTags,
          sha,
          spreadsheetId: spreadsheet.spreadsheetId,
          sheetType,
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );

    return spreadsheet;
  }

  public createHyperlink(url: string, text: string) {
    return `=HYPERLINK("${url}","${text}")`;
  }

  private publishSheet(fileId: string) {
    return Promise.all([
      this.drive.permissions.create({
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
        fileId,
      }),
      this.drive.revisions.update({
        requestBody: {
          publishedOutsideDomain: true,
          publishAuto: true,
          published: true,
        },
        revisionId: '1',
        fields: '*',
        fileId,
      }),
    ]);
  }

  private async createSheetRequest(title: string, sheets: CreateGoogleSheet[]) {
    const { data } = await this.sheet.spreadsheets.create({
      requestBody: {
        properties: { title },
        sheets: sheets.map((sheet, sheetId) => ({
          properties: {
            sheetId,
            index: sheetId,
            title: escapeSheetName(sheet.title),
            gridProperties: {
              rowCount: Math.max(sheet.rows.length + 1, 25),
              columnCount: Math.max(sheet.columns.length, 15),
              frozenRowCount: sheet.rows.length ? 1 : 0,
            },
          },
        })),
      },
      fields: 'spreadsheetId,spreadsheetUrl',
    });
    return data;
  }

  private createSHA(guildId: string, clanTags: string[], sheetType: SheetType) {
    const text = `${guildId}-${clanTags
      .map((tag) => tag)
      .sort((a, b) => a.localeCompare(b))
      .join('-')}-${sheetType}`;
    return createHash('md5').update(text).digest('hex');
  }
}
