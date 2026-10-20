import { ValidationPipe } from '@nestjs/common';
import { Db } from 'mongodb';
import { ServerConfigInput } from './dto';
import { GuildConfigService } from './guild-config.service';

const GUILD = '111111111111111111';

type Doc = Record<string, unknown>;

const setup = (settings?: Doc) => {
  const docs: Doc[] = settings ? [{ guildId: GUILD, ...settings }] : [];
  const collection = {
    findOne: (filter: Doc) =>
      Promise.resolve(docs.find((d) => d.guildId === filter.guildId) ?? null),
    updateOne: (filter: Doc, update: Record<string, Doc>) => {
      let doc = docs.find((d) => d.guildId === filter.guildId);
      if (!doc) docs.push((doc = { ...filter }));
      Object.assign(doc, update.$set ?? {});
      for (const key of Object.keys(update.$unset ?? {})) delete doc[key];
      return Promise.resolve();
    },
  };
  const service = new GuildConfigService({ collection: () => collection } as unknown as Db);
  return { service, docs };
};

const validate = (body: unknown) =>
  new ValidationPipe({ transform: true, whitelist: true }).transform(body, {
    type: 'body',
    metatype: ServerConfigInput,
  });

describe('GuildConfigService', () => {
  it('reads the defaults, and clamps a limit the bot would clamp', async () => {
    await expect(setup().service.get(GUILD)).resolves.toEqual({ color: null, webhookLimit: 8 });
    await expect(setup({ color: 0x5865f2, webhookLimit: 20 }).service.get(GUILD)).resolves.toEqual({
      color: 0x5865f2,
      webhookLimit: 8,
    });
  });

  it('saves only the fields sent, and null clears the colour', async () => {
    const { service, docs } = setup({ color: 0xff0000, webhookLimit: 5 });
    await service.save(GUILD, { webhookLimit: 4 });
    expect(docs[0]).toEqual({ guildId: GUILD, color: 0xff0000, webhookLimit: 4 });

    const result = await service.save(GUILD, { color: null });
    expect(docs[0]).toEqual({ guildId: GUILD, webhookLimit: 4 });
    expect(result).toEqual({ color: null, webhookLimit: 4 });
  });

  it('accepts a null colour and rejects limits outside 3 to 8', async () => {
    await expect(validate({ color: null })).resolves.toEqual({ color: null });
    await expect(validate({ webhookLimit: 2 })).rejects.toThrow();
    await expect(validate({ webhookLimit: 9 })).rejects.toThrow();
    await expect(validate({ color: 0x1000000 })).rejects.toThrow();
  });
});
