import { ButtonEmbedConfig } from '@app/collections';
import { Inject, Injectable } from '@nestjs/common';
import { Db } from 'mongodb';
import { Collections, MONGODB_TOKEN } from '../db';
import {
  ButtonMessageDto,
  ButtonMessageInput,
  ButtonsDto,
  ButtonTokenField,
  ButtonType,
} from './dto';

const KEYS = {
  [ButtonType.LINK]: 'linkEmbeds',
  [ButtonType.REFRESH]: 'refreshEmbeds',
  [ButtonType.MY_ROSTERS]: 'myRostersEmbeds',
} as const;

/** The `/setup buttons` messages in `Settings`; the bot reloads them when they change. */
@Injectable()
export class GuildButtonsService {
  constructor(@Inject(MONGODB_TOKEN) private readonly db: Db) {}

  async get(guildId: string): Promise<ButtonsDto> {
    const settings = await this.settings.findOne({ guildId });
    const read = (type: ButtonType) => {
      const config = settings?.[KEYS[type]];
      return config ? toDto(type, config) : null;
    };
    return {
      link: read(ButtonType.LINK),
      refresh: read(ButtonType.REFRESH),
      myRosters: read(ButtonType.MY_ROSTERS),
    };
  }

  async save(guildId: string, type: ButtonType, body: ButtonMessageInput) {
    const config: ButtonEmbedConfig = {
      title: body.title,
      description: body.description,
      image_url: body.imageUrl || '',
      thumbnail_url: body.thumbnailUrl || '',
      button_style: body.buttonStyle,
      embed_color: body.color ?? null,
      ...(type === ButtonType.LINK
        ? { token_field: body.tokenField ?? ButtonTokenField.OPTIONAL }
        : {}),
    };
    await this.settings.updateOne(
      { guildId },
      { $set: { [KEYS[type]]: config } },
      { upsert: true },
    );
    return this.get(guildId);
  }

  private get settings() {
    return this.db.collection(Collections.SETTINGS);
  }
}

function toDto(type: ButtonType, config: Partial<ButtonEmbedConfig>): ButtonMessageDto {
  return {
    title: config.title ?? '',
    description: config.description ?? '',
    imageUrl: config.image_url || null,
    thumbnailUrl: config.thumbnail_url || null,
    color: config.embed_color || null,
    buttonStyle: config.button_style || 1,
    ...(type === ButtonType.LINK
      ? { tokenField: (config.token_field as ButtonTokenField) ?? ButtonTokenField.OPTIONAL }
      : {}),
  };
}
