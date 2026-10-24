import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ClashClientService } from './clash-client.service';

const respond = (status: number, body: unknown = {}) =>
  Promise.resolve({ body, res: { status, ok: status === 200 } });

const createService = (status: number, body?: unknown) =>
  new ClashClientService(
    {
      getPlayer: () => respond(status, body),
      getClan: () => respond(status, body),
      getClanWarLeagueGroup: () => respond(status, body),
      verifyPlayerToken: () => respond(status, body),
    } as never,
    {} as never,
  );

describe('ClashClientService errors', () => {
  it('is not found only when the game API answers 404', async () => {
    await expect(createService(404).getPlayerOrThrow('#P')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(createService(404).getClanOrThrow('#C')).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([500, 503, 429])('is unavailable when the game API answers %i', async (status) => {
    await expect(createService(status).getPlayerOrThrow('#P')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(createService(status).getClanOrThrow('#C')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(createService(status).getClanWarLeague('#C')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(createService(status).verifyPlayerOrThrow('#P', 'token')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('is not found for a clan outside CWL or a wrong token', async () => {
    await expect(
      createService(200, { state: 'notInWar' }).getClanWarLeague('#C'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      createService(200, { status: 'invalid' }).verifyPlayerOrThrow('#P', 'token'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
