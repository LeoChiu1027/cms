import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { EntityManager, MikroORM } from '@mikro-orm/core';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { Tag } from '../src/content/entities/tag.entity';
import './matchers/db.matcher';

describe('Tags (e2e)', () => {
  let app: INestApplication;
  let orm: MikroORM;
  let em: EntityManager;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.use(cookieParser());

    orm = moduleFixture.get<MikroORM>(MikroORM);
    em = orm.em.fork();
    await orm.schema.dropSchema();
    await orm.schema.createSchema();

    await app.init();

    // Create a user and get access token
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'taguser@example.com',
        password: 'TagPass123!',
        firstName: 'Tag',
        lastName: 'User',
      });
    accessToken = response.body.accessToken;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // =========================================
  // POST /tags - Create Tag
  // =========================================

  describe('POST /tags', () => {
    it('should return 201 and create tag with valid data', async () => {
      const response = await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Technology',
          slug: 'technology',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        name: 'Technology',
        slug: 'technology',
        createdAt: expect.any(String),
      });

      // Database validation
      await expect({ entity: Tag, id: response.body.id }).toMatchInDb(em, {
        name: 'Technology',
        slug: 'technology',
      });
    });

    it('should return 400 when name is missing', async () => {
      const response = await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          slug: 'no-name',
        })
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([expect.stringMatching(/name/)]),
      );
    });

    it('should return 400 when slug is missing', async () => {
      const response = await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'No Slug',
        })
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([expect.stringMatching(/slug/)]),
      );
    });

    it('should return 400 with invalid slug format (uppercase)', async () => {
      const response = await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Invalid Slug',
          slug: 'Invalid-Slug',
        })
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([expect.stringMatching(/slug/)]),
      );
    });

    it('should return 400 with invalid slug format (spaces)', async () => {
      await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Spaces Tag',
          slug: 'has spaces',
        })
        .expect(400);
    });

    it('should return 409 when slug already exists', async () => {
      // First create
      await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Duplicate Tag',
          slug: 'duplicate-tag',
        })
        .expect(201);

      // Attempt duplicate
      const response = await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Duplicate Tag 2',
          slug: 'duplicate-tag',
        })
        .expect(409);

      expect(response.body.message).toMatch(/slug|exists|conflict/i);
    });

    it('should return 409 when name already exists', async () => {
      // First create
      await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Unique Name Tag',
          slug: 'unique-name-tag',
        })
        .expect(201);

      // Attempt duplicate name
      const response = await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Unique Name Tag',
          slug: 'different-slug',
        })
        .expect(409);

      expect(response.body.message).toMatch(/name|exists|conflict/i);
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .post('/tags')
        .send({
          name: 'Unauth Tag',
          slug: 'unauth-tag',
        })
        .expect(401);
    });
  });

  // =========================================
  // GET /tags - List Tags
  // =========================================

  describe('GET /tags', () => {
    beforeAll(async () => {
      // Create some tags for testing list functionality
      const tags = [
        { name: 'Programming', slug: 'programming' },
        { name: 'JavaScript', slug: 'javascript' },
        { name: 'TypeScript', slug: 'typescript' },
        { name: 'NestJS', slug: 'nestjs' },
        { name: 'React', slug: 'react' },
      ];

      for (const tag of tags) {
        await request(app.getHttpServer())
          .post('/tags')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(tag);
      }
    });

    it('should return 200 with paginated list of tags', async () => {
      const response = await request(app.getHttpServer())
        .get('/tags')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        data: expect.any(Array),
        meta: {
          page: 1,
          limit: 20,
          total: expect.any(Number),
          totalPages: expect.any(Number),
        },
      });
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        slug: expect.any(String),
        createdAt: expect.any(String),
      });
    });

    it('should support pagination with page and limit', async () => {
      const response = await request(app.getHttpServer())
        .get('/tags?page=1&limit=2')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(2);
      expect(response.body.meta.limit).toBe(2);
      expect(response.body.meta.page).toBe(1);
    });

    it('should filter by search term (name)', async () => {
      const response = await request(app.getHttpServer())
        .get('/tags?search=script')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Should match JavaScript and TypeScript
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
      response.body.data.forEach((tag: Tag) => {
        expect(tag.name.toLowerCase()).toContain('script');
      });
    });

    it('should return empty array when search has no matches', async () => {
      const response = await request(app.getHttpServer())
        .get('/tags?search=nonexistenttag123')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(0);
      expect(response.body.meta.total).toBe(0);
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer()).get('/tags').expect(401);
    });
  });

  // =========================================
  // GET /tags/:id - Get Tag by ID
  // =========================================

  describe('GET /tags/:id', () => {
    let testTagId: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Get By ID Tag',
          slug: 'get-by-id-tag',
        });
      testTagId = response.body.id;
    });

    it('should return 200 with tag details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/tags/${testTagId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testTagId,
        name: 'Get By ID Tag',
        slug: 'get-by-id-tag',
        createdAt: expect.any(String),
      });
    });

    it('should return 404 for non-existent tag', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .get(`/tags/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 400 for invalid UUID format', async () => {
      await request(app.getHttpServer())
        .get('/tags/invalid-uuid')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .get(`/tags/${testTagId}`)
        .expect(401);
    });
  });

  // =========================================
  // DELETE /tags/:id - Delete Tag
  // =========================================

  describe('DELETE /tags/:id', () => {
    let tagToDeleteId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: `Delete Tag ${Date.now()}`,
          slug: `delete-tag-${Date.now()}`,
        });
      tagToDeleteId = response.body.id;
    });

    it('should return 204 and delete the tag', async () => {
      await request(app.getHttpServer())
        .delete(`/tags/${tagToDeleteId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      // Verify tag is deleted from database
      await expect({ entity: Tag, id: tagToDeleteId }).toNotExistInDb(em);
    });

    it('should return 404 when deleting non-existent tag', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .delete(`/tags/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 400 for invalid UUID format', async () => {
      await request(app.getHttpServer())
        .delete('/tags/invalid-uuid')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .delete(`/tags/${tagToDeleteId}`)
        .expect(401);
    });
  });
});
