import { Body, Controller, INestApplication, Post, QueryMethod } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as Sentry from '@sentry/nestjs';
import { AddressInfo } from 'node:net';
import { DeprecatedPost } from './deprecated-post.decorator';

vi.mock('@sentry/nestjs', () => ({ logger: { warn: vi.fn() } }));

@Controller('/things')
class ThingsController {
  @QueryMethod('/search')
  search(@Body() body: { tag: string }) {
    return { tag: body.tag };
  }

  @Post('/search')
  @DeprecatedPost()
  searchViaPost(@Body() body: { tag: string }) {
    return this.search(body);
  }
}

describe('QUERY routes and their deprecated POST', () => {
  let app: INestApplication;
  let url: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [ThingsController] }).compile();
    app = module.createNestApplication({ logger: false });
    await app.listen(0);
    url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/things/search`;
  });

  afterAll(() => app.close());

  const send = (method: string) =>
    fetch(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tag: '#2PP' }),
    });

  it('answers QUERY with the request body, without deprecation headers', async () => {
    const res = await send('QUERY');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tag: '#2PP' });
    expect(res.headers.get('deprecation')).toBeNull();
    expect(Sentry.logger.warn).not.toHaveBeenCalled();
  });

  it('still answers POST, flagged deprecated with a sunset date, and logs the caller', async () => {
    const res = await send('POST');
    expect(await res.json()).toEqual({ tag: '#2PP' });
    expect(res.headers.get('deprecation')).toBe('@1792886400');
    expect(res.headers.get('sunset')).toBe('Wed, 25 Nov 2026 00:00:00 GMT');
    expect(Sentry.logger.warn).toHaveBeenCalledWith(
      'Deprecated route called',
      expect.objectContaining({ method: 'POST', route: '/things/search' }),
    );
  });
});
