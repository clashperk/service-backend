import { drive as _drive, drive_v3 } from '@googleapis/drive';
import { auth as _auth } from '@googleapis/oauth2';
import { sheets as _sheet, type sheets_v4 } from '@googleapis/sheets';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CreateGoogleSheet {
  title: string;
  columns: { align: string; width: number; name: string; note?: string }[];
  rows: (string | number | Date | boolean | undefined | null)[][];
}

@Injectable()
export class GoogleSheetService {
  private drive: drive_v3.Drive;
  private sheet: sheets_v4.Sheets;
  private readonly allowedFormulas = ['=HYPERLINK(', '=IMAGE(', '=SUM('];

  constructor(configService: ConfigService) {
    const auth = new _auth.OAuth2({
      client_id: configService.getOrThrow('GOOGLE_CLIENT_ID'),
      client_secret: configService.getOrThrow('GOOGLE_CLIENT_SECRET'),
    });
    auth.setCredentials({ refresh_token: configService.getOrThrow('GOOGLE_REFRESH_TOKEN') });

    this.drive = _drive({ version: 'v3', auth });
    this.sheet = _sheet({ version: 'v4', auth });
  }

  private dateToSerialDate(inputDate: Date) {
    const baseDate = new Date('1899-12-30').getTime();
    const diffDays = (inputDate.getTime() - baseDate) / (24 * 60 * 60 * 1000);
    return diffDays + 1;
  }

  private escapeSheetName(name: string) {
    return name.replace(/[\*\?\:\[\]\\\/\']/g, ''); // eslint-disable-line
  }

  private async publish(fileId: string) {
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

  private getSheetValue(value?: string | number | boolean | Date | null) {
    if (
      typeof value === 'string' &&
      this.allowedFormulas.some((formula) => value.startsWith(formula))
    ) {
      return { formulaValue: value };
    }

    if (typeof value === 'string') return { stringValue: value };
    if (typeof value === 'number') return { numberValue: value };
    if (typeof value === 'boolean') return { boolValue: value };
    if (value instanceof Date) return { numberValue: this.dateToSerialDate(value) };
    return {};
  }

  private getUserEnteredFormat(value?: string | number | boolean | Date | null) {
    if (value instanceof Date) return { numberFormat: { type: 'DATE_TIME' } };
    if (
      typeof value === 'string' &&
      this.allowedFormulas.some((formula) => value.startsWith(formula))
    ) {
      return { hyperlinkDisplayType: 'LINKED' };
    }

    if (typeof value === 'number' && value % 1 !== 0) {
      return {
        numberFormat: {
          type: 'NUMBER',
          pattern: '0.00',
        },
      };
    }

    return {};
  }

  createHyperlink(url: string, text: string) {
    return `=HYPERLINK("${url}","${text}")`;
  }

  private getConditionalFormatRequests(sheets: CreateGoogleSheet[]) {
    const gridStyleRequests: sheets_v4.Schema$Request[] = sheets
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
  }

  private getStyleRequests(sheets: CreateGoogleSheet[]) {
    const styleRequests: sheets_v4.Schema$Request[] = sheets
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
  }

  private async createSheetRequest(title: string, sheets: CreateGoogleSheet[]) {
    const { data } = await this.sheet.spreadsheets.create({
      requestBody: {
        properties: { title },
        sheets: sheets.map((sheet, sheetId) => ({
          properties: {
            sheetId,
            index: sheetId,
            title: this.escapeSheetName(sheet.title),
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

  private createColumnRequest(columns: CreateGoogleSheet['columns']) {
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
        note: column.note,
      })),
    };
  }

  async updateGoogleSheet(
    spreadsheetId: string,
    sheets: CreateGoogleSheet[],
    options: { clear: boolean; recreate: boolean; title: string },
  ) {
    const replaceSheetRequests: sheets_v4.Schema$Request[] = [];

    if (options.recreate) {
      const {
        data: { sheets: oldSheets },
      } = await this.sheet.spreadsheets.get({ spreadsheetId });

      replaceSheetRequests.push(
        ...(oldSheets || []).slice(1).map((_, idx) => ({
          deleteSheet: { sheetId: idx + 1 },
        })),
      );

      replaceSheetRequests.push(
        ...sheets.slice(1).map((sheet, sheetId) => ({
          addSheet: {
            properties: {
              sheetId: sheetId + 1,
              title: this.escapeSheetName(sheet.title),
              gridProperties: {
                rowCount: Math.max(sheet.rows.length + 1, 25),
                columnCount: Math.max(sheet.columns.length, 15),
                frozenRowCount: sheet.rows.length ? 1 : 0,
              },
            },
          },
        })),
      );

      if (replaceSheetRequests.length) {
        await this.sheet.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [...replaceSheetRequests],
          },
        });
      }
    }

    const clearSheetRequests: sheets_v4.Schema$Request[] = sheets
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

    const requests: sheets_v4.Schema$Request[] = sheets.map((sheet, sheetId) => ({
      updateCells: {
        start: {
          sheetId,
          rowIndex: 0,
          columnIndex: 0,
        },
        rows: [
          this.createColumnRequest(sheet.columns),
          ...sheet.rows.map((values) => ({
            values: values.map((value) => ({
              userEnteredValue: this.getSheetValue(value),
              userEnteredFormat: this.getUserEnteredFormat(value),
            })),
          })),
        ],
        fields: '*',
      },
    }));

    await this.sheet.spreadsheets.batchUpdate(
      {
        spreadsheetId,
        requestBody: {
          requests: [
            {
              updateSpreadsheetProperties: {
                properties: { title: options.title },
                fields: 'title',
              },
            },
            ...(options.clear ? clearSheetRequests : []),
            ...requests,
            ...this.getStyleRequests(sheets),
            ...this.getConditionalFormatRequests(sheets),
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
      },
      { retry: true },
    );

    return {
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    };
  }

  async createGoogleSheet(title: string, sheets: CreateGoogleSheet[]) {
    const spreadsheet = await this.createSheetRequest(title, sheets);

    await Promise.all([
      this.updateGoogleSheet(spreadsheet.spreadsheetId!, sheets, {
        clear: false,
        recreate: false,
        title,
      }),
      this.publish(spreadsheet.spreadsheetId!),
    ]);

    return {
      spreadsheetId: spreadsheet.spreadsheetId!,
      spreadsheetUrl: spreadsheet.spreadsheetUrl!,
    };
  }
}
