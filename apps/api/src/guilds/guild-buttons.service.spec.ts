import { Db } from 'mongodb';
import { Collections } from '../db';
import { ButtonTokenField, ButtonType } from './dto';
import { GuildButtonsService } from './guild-buttons.service';

const GUILD = '111111111111111111';

type Doc = Record<string, unknown>;

const setup = (settings?: Doc) => {
  const docs: Doc[] = settings ? [{ guildId: GUILD, ...settings }] : [];
  const collection = (name: string) => {
    expect(name).toBe(Collections.SETTINGS);
    const find = (filter: Doc) => docs.find((d) => d.guildId === filter.guildId);
    return {
      findOne: (filter: Doc) => Promise.resolve(find(filter) ?? null),
      updateOne: (filter: Doc, update: { $set: Doc }, options?: { upsert?: boolean }) => {
        let doc = find(filter);
        if (!doc && options?.upsert) docs.push((doc = { ...filter }));
        Object.assign(doc!, update.$set);
        return Promise.resolve();
      },
    };
  };
  const service = new GuildButtonsService({ collection } as unknown as Db);
  return { service, doc: () => docs[0] };
};

const input = {
  title: 'Welcome',
  description: 'Click below',
  imageUrl: null,
  thumbnailUrl: 'https://cdn.example.com/icon.png',
  color: 0x5865f2,
  buttonStyle: 3,
};

describe('GuildButtonsService', () => {
  it('reads null for buttons never customized', async () => {
    const { service } = setup();
    expect(await service.get(GUILD)).toEqual({ link: null, refresh: null, myRosters: null });
  });

  it('maps the bot record, with empty images and colors as null', async () => {
    const { service } = setup({
      refreshEmbeds: {
        title: 'Roles',
        description: 'Refresh',
        image_url: '',
        thumbnail_url: 'https://x.test/a.png',
        button_style: 4,
        embed_color: 0,
      },
    });
    expect((await service.get(GUILD)).refresh).toEqual({
      title: 'Roles',
      description: 'Refresh',
      imageUrl: null,
      thumbnailUrl: 'https://x.test/a.png',
      color: null,
      buttonStyle: 4,
    });
  });

  it('writes the whole link record in the bot shape, token field included', async () => {
    const { service, doc } = setup();
    const result = await service.save(GUILD, ButtonType.LINK, {
      ...input,
      tokenField: ButtonTokenField.HIDDEN,
    });
    expect(doc().linkEmbeds).toEqual({
      title: 'Welcome',
      description: 'Click below',
      image_url: '',
      thumbnail_url: 'https://cdn.example.com/icon.png',
      button_style: 3,
      embed_color: 0x5865f2,
      token_field: 'hidden',
    });
    expect(result.link?.tokenField).toBe(ButtonTokenField.HIDDEN);
  });

  it('keeps the token field off other buttons and defaults it to optional on link', async () => {
    const { service, doc } = setup();
    await service.save(GUILD, ButtonType.MY_ROSTERS, {
      ...input,
      tokenField: ButtonTokenField.REQUIRED,
    });
    await service.save(GUILD, ButtonType.LINK, input);
    expect(doc().myRostersEmbeds).not.toHaveProperty('token_field');
    expect(doc().linkEmbeds).toMatchObject({ token_field: 'optional' });
  });
});
