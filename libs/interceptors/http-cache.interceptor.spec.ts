import { CACHE_TTL_METADATA } from '@nestjs/cache-manager';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { CACHE_UNORDERED_BODY, HttpCacheInterceptor } from './http-cache.interceptor';

function keyFor(body: object, unordered: boolean) {
  const handler = () => undefined;
  Reflect.defineMetadata(CACHE_TTL_METADATA, 600_000, handler);
  Reflect.defineMetadata(CACHE_UNORDERED_BODY, unordered, handler);

  const req = {
    method: 'QUERY',
    path: '/v1/players/battle-log/leaderboard',
    originalUrl: '/v1/players/battle-log/leaderboard',
    body,
    rawBody: Buffer.from(JSON.stringify(body)),
  };
  const context = {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;

  const interceptor = new HttpCacheInterceptor({}, new Reflector());
  return interceptor.trackBy(context);
}

describe('HttpCacheInterceptor', () => {
  const a = { seasonId: '2026-10-05', playerTags: ['#B', '#A', '#C'] };
  const b = { playerTags: ['#C', '#B', '#A'], seasonId: '2026-10-05' };

  it('shares a key for reordered bodies when unordered', () => {
    expect(keyFor(a, true)).toBe(keyFor(b, true));
  });

  it('keeps distinct keys for different sets', () => {
    expect(keyFor(a, true)).not.toBe(keyFor({ ...a, playerTags: ['#A', '#B'] }, true));
  });

  it('hashes the raw body when ordered', () => {
    expect(keyFor(a, false)).not.toBe(keyFor(b, false));
  });
});
