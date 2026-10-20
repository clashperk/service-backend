import { UserRoles } from '@app/dto';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Db } from 'mongodb';
import { AddPortalUserInput } from './dto/portal-users.dto';
import { PortalUsersService } from './portal-users.service';

jest.mock('@app/discord-rest', () => ({ DiscordRestService: class {} }));

const USER = '111111111111111111';

type Doc = Record<string, unknown>;

const setup = (existing: Doc[] = []) => {
  const docs = [...existing];
  const collection = {
    find: jest.fn(() => ({ toArray: () => Promise.resolve(docs) })),
    findOne: (filter: Doc) =>
      Promise.resolve(
        docs.find((d) => d.userId === filter.userId && d.deletedAt === filter.deletedAt) ?? null,
      ),
    findOneAndUpdate: (filter: Doc, update: Record<string, Doc>) => {
      let doc = docs.find(
        (d) =>
          d.userId === filter.userId &&
          (!('deletedAt' in filter) || d.deletedAt === filter.deletedAt),
      );
      if (!doc) docs.push((doc = { ...update.$setOnInsert }));
      Object.assign(doc, update.$set);
      return Promise.resolve(doc);
    },
    updateOne: (filter: Doc, update: Record<string, Doc>) => {
      const doc = docs.find((d) => d.userId === filter.userId && d.deletedAt === filter.deletedAt);
      if (doc) Object.assign(doc, update.$set);
      return Promise.resolve();
    },
  };
  const discord = {
    getUser: jest.fn().mockResolvedValue({ username: 'chief', global_name: 'Chief', bot: false }),
  };
  const service = new PortalUsersService(
    { collection: () => collection } as unknown as Db,
    discord as never,
  );
  return { service, docs, collection };
};

describe('PortalUsersService', () => {
  it('lists accounts without passkeys', async () => {
    const { service, collection } = setup();
    await service.list();
    expect(collection.find).toHaveBeenCalledWith(
      { deletedAt: null },
      { projection: { passKey: 0 }, sort: { createdAt: -1 } },
    );
  });

  it('adds an account with a fresh passkey and returns it once', async () => {
    const { service, docs } = setup();
    const result = await service.add({
      userId: USER,
      roles: [UserRoles.FETCH_LINKS, UserRoles.FETCH_LINKS, UserRoles.VIEWER],
    });
    expect(result.passKey).toMatch(/^[0-9a-f]{32}$/);
    expect(result.user).toMatchObject({
      userId: USER,
      username: 'chief',
      displayName: 'Chief',
      isBot: false,
      roles: [UserRoles.FETCH_LINKS, UserRoles.VIEWER],
      lastLoginAt: null,
    });
    expect(result.user).not.toHaveProperty('passKey');
    expect(docs[0]).toMatchObject({ passKey: result.passKey, guildIds: [], deletedAt: null });
  });

  it('never replaces an existing account', async () => {
    const { service } = setup([{ userId: USER, passKey: 'old', deletedAt: null }]);
    await expect(service.add({ userId: USER, roles: [UserRoles.VIEWER] })).rejects.toThrow(
      ConflictException,
    );
  });

  it('refuses to grant admin', async () => {
    const pipe = new ValidationPipe({ transform: true, whitelist: true });
    const validate = (body: unknown) =>
      pipe.transform(body, { type: 'body', metatype: AddPortalUserInput });
    await expect(validate({ userId: USER, roles: ['fetch:links'] })).resolves.toBeDefined();
    await expect(validate({ userId: USER, roles: ['admin'] })).rejects.toThrow();
    await expect(validate({ userId: USER, roles: [] })).rejects.toThrow();
  });

  it('edits roles, and revokes by retiring the passkey', async () => {
    const { service, docs } = setup([
      { userId: USER, roles: [UserRoles.VIEWER], passKey: 'old', deletedAt: null },
    ]);
    const edited = await service.edit(USER, [UserRoles.FETCH_WARS]);
    expect(edited.roles).toEqual([UserRoles.FETCH_WARS]);

    await service.revoke(USER);
    expect(docs[0].deletedAt).toBeInstanceOf(Date);
    expect(docs[0].passKey).not.toBe('old');
    await expect(service.edit(USER, [UserRoles.VIEWER])).rejects.toThrow(NotFoundException);
  });

  it('leaves admin accounts alone', async () => {
    const { service } = setup([
      { userId: USER, roles: [UserRoles.ADMIN], passKey: 'old', deletedAt: null },
    ]);
    await expect(service.revoke(USER)).rejects.toThrow(BadRequestException);
    await expect(service.edit(USER, [UserRoles.VIEWER])).rejects.toThrow(BadRequestException);
  });
});
