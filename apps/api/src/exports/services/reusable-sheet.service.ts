import { CreateGoogleSheet, GoogleSheetService } from '@app/google-sheet';
import { Inject } from '@nestjs/common';
import { Db } from 'mongodb';
import { createHash } from 'node:crypto';
import { Collections, MONGODB_TOKEN } from '../../db';

export enum SheetType {
  CLAN_MEMBERS = 'CLAN_MEMBERS',
  REGULAR_WARS = 'REGULAR_WARS',
  COMBINED_WARS = 'COMBINED_WARS',
  FRIENDLY_WARS = 'FRIENDLY_WARS',
  CWL_WARS = 'CWL_WARS',
  ATTACK_LOG = 'ATTACK_LOG',
  SEASON = 'SEASON',
  ROSTERS = 'ROSTERS',
  CLANS = 'CLANS',
}

interface CreateSheetProps {
  sheets: CreateGoogleSheet[];
  guildId: string;
  clanTags: string[];
  label: string;
  sheetType: SheetType;
  scheduled: boolean;
}

export class ReusableSheetService {
  constructor(
    @Inject(MONGODB_TOKEN) private db: Db,
    private googleSheetService: GoogleSheetService,
  ) {}

  public async createOrUpdateSheet({
    sheets,
    guildId,
    clanTags,
    label,
    sheetType,
    scheduled,
  }: CreateSheetProps) {
    const hash = this.createSpreadsheetHash({ clanTags, guildId, sheetType, scheduled });
    const sheetHash = this.createSheetsHash(sheets);
    const sheet = await this.googleSheets.findOne({ hash });

    let spreadsheet;
    if (sheet) {
      try {
        spreadsheet = await this.googleSheetService.updateGoogleSheet(sheet.spreadsheetId, sheets, {
          title: `${label}`,
          clear: true,
          recreate: sheet && sheetHash !== sheet.sheetHash,
        });
      } catch (error) {
        if (/invalid requests/i.test(error.message)) {
          spreadsheet = await this.googleSheetService.createGoogleSheet(`${label}`, sheets);
        } else {
          throw error;
        }
      }
    } else {
      spreadsheet = await this.googleSheetService.createGoogleSheet(`${label}`, sheets);
    }

    await this.googleSheets.updateOne(
      { hash },
      {
        $inc: { exported: 1 },
        $set: {
          updatedAt: new Date(),
          sheetCount: sheets.length,
          sheetHash,
          spreadsheetId: spreadsheet.spreadsheetId,
        },
        $setOnInsert: {
          guildId,
          clanTags,
          scheduled,
          hash,
          sheetType,
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );

    return spreadsheet as {
      spreadsheetUrl: string;
      spreadsheetId: string;
    };
  }

  public async getSheet(input: {
    guildId: string;
    clanTags: string[];
    sheetType: SheetType;
    scheduled: boolean;
  }) {
    if (!input.scheduled) return null;

    const sheet = await this.googleSheets.findOne({
      hash: this.createSpreadsheetHash(input),
      scheduled: true,
    });
    if (!sheet) return null;

    return {
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${sheet.spreadsheetId}`,
      spreadsheetId: sheet.spreadsheetId,
    };
  }

  private createSpreadsheetHash(input: {
    guildId: string;
    clanTags: string[];
    sheetType: SheetType;
    scheduled: boolean;
  }) {
    const { guildId, clanTags, sheetType, scheduled } = input;

    let text = `${guildId}-${clanTags
      .map((tag) => tag)
      .sort((a, b) => a.localeCompare(b))
      .join('-')}-${sheetType}`;
    if (scheduled) text += `-scheduled`;

    return createHash('md5').update(text).digest('hex');
  }

  private createSheetsHash(sheets: CreateGoogleSheet[]) {
    return createHash('md5')
      .update(sheets.map((sheet) => sheet.title).join('-'))
      .digest('hex');
  }

  private get googleSheets() {
    return this.db.collection(Collections.GOOGLE_SHEETS);
  }
}
