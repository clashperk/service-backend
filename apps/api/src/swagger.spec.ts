import { UserRoles } from '@app/dto';
import { Type, VersioningType } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { OpenAPIObject } from '@nestjs/swagger';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { API_TAG_DESCRIPTIONS, ApiTag } from './api-tags';
import { createDocuments, documentFor } from './swagger';

jest.mock('@app/clash-client', () => ({ ClashClientService: class {} }));

const loadControllers = async () => {
  const files = (readdirSync(__dirname, { recursive: true }) as string[]).filter((file) =>
    file.endsWith('.controller.ts'),
  );
  const modules = await Promise.all(
    files.map((file) => import(join(__dirname, file)) as Promise<Record<string, unknown>>),
  );
  return modules
    .flatMap((exports) => Object.values(exports))
    .filter((value): value is Type => typeof value === 'function')
    .filter((value) => Reflect.getMetadata(PATH_METADATA, value) !== undefined);
};

type Operation = { 'tags'?: string[]; 'x-required-roles'?: UserRoles[]; 'x-internal'?: number };

const operations = (document: OpenAPIObject) =>
  Object.values(document.paths).flatMap((item) => Object.values(item) as Operation[]);

describe('Swagger documents', () => {
  let documents: { document: OpenAPIObject; published: OpenAPIObject };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: await loadControllers() })
      .useMocker(() => ({ getOrThrow: () => 'secret', get: () => undefined }))
      .compile();
    const app = module.createNestApplication();
    app.enableVersioning({ defaultVersion: ['1', '2'], type: VersioningType.URI });
    documents = createDocuments(app);
  });

  it('tags every route with a known tag', () => {
    for (const operation of operations(documents.document)) {
      expect(operation.tags).toHaveLength(1);
      expect(Object.keys(API_TAG_DESCRIPTIONS)).toContain(operation.tags?.[0]);
    }
  });

  it('publishes only routes an API token can call', () => {
    const published = operations(documents.published);
    expect(published.length).toBeGreaterThan(0);
    for (const operation of published) {
      expect(operation['x-internal']).toBeUndefined();
      const roles = operation['x-required-roles'] ?? [];
      const apiRoles = roles.filter((role) => role !== UserRoles.USER && role !== UserRoles.ADMIN);
      expect(roles.length === 0 || apiRoles.length > 0).toBe(true);
    }
  });

  it('lists only the tags it publishes, in order', () => {
    const tags = documents.published.tags?.map((tag) => tag.name);
    expect(tags).not.toContain(ApiTag.ADMIN);
    expect(tags).not.toContain(ApiTag.INTERNAL);
    expect(tags).not.toContain(ApiTag.GUILDS);
    expect(tags?.slice(0, 2)).toEqual([ApiTag.AUTH, ApiTag.PLAYERS]);
  });

  describe('documentFor', () => {
    const prod = { apiKey: 'key', isProd: true };
    const paths = (document: OpenAPIObject) => Object.keys(document.paths).length;

    it('serves the published document to anyone in production, typings view included', () => {
      expect(documentFor(documents, {}, prod)).toBe(documents.published);
      const typings = documentFor(documents, { query: { 'x-typings-ignored': '1' } }, prod);
      expect(paths(typings)).toBeLessThanOrEqual(paths(documents.published));
    });

    it('serves the full document with the API key cookie, or outside production', () => {
      expect(documentFor(documents, { cookies: { 'x-api-key': 'key' } }, prod)).toBe(
        documents.document,
      );
      expect(documentFor(documents, { cookies: { 'x-api-key': 'nope' } }, prod)).toBe(
        documents.published,
      );
      expect(documentFor(documents, {}, { ...prod, isProd: false })).toBe(documents.document);
    });
  });
});
