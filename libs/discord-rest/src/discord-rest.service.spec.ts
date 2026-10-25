import { DiscordAPIError, REST } from '@discordjs/rest';
import { ConfigService } from '@nestjs/config';
import { RESTJSONErrorCodes } from 'discord-api-types/v10';
import { BotNotInGuildException, DiscordRestService } from './discord-rest.service';

const discordError = (code: number, status: number) =>
  new DiscordAPIError({ code, message: 'Discord says no' }, code, status, 'GET', '/guilds/1', {});

describe('DiscordRestService on a server the bot is not in', () => {
  const service = new DiscordRestService({
    getOrThrow: () => 'bot-token',
  } as unknown as ConfigService);
  const get = vi.spyOn(REST.prototype, 'get');

  afterEach(() => get.mockReset());

  it.each([
    ['Missing Access', RESTJSONErrorCodes.MissingAccess, 403],
    ['Unknown Guild', RESTJSONErrorCodes.UnknownGuild, 404],
  ])('turns %s into BotNotInGuildException', async (_, code, status) => {
    get.mockRejectedValueOnce(discordError(code, status));
    await expect(service.listChannels({ guildId: '1', token: null })).rejects.toBeInstanceOf(
      BotNotInGuildException,
    );
  });

  it('passes other Discord errors through', async () => {
    const error = discordError(RESTJSONErrorCodes.MissingPermissions, 403);
    get.mockRejectedValueOnce(error);
    await expect(service.getGuild({ guildId: '1', token: null })).rejects.toBe(error);
  });
});
