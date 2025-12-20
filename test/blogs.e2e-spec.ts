import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { EntityManager, MikroORM } from '@mikro-orm/core';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { Content } from '../src/content/entities/content.entity';
import { Blog } from '../src/content/entities/blog.entity';
import { Tag } from '../src/content/entities/tag.entity';
import { ContentTag } from '../src/content/entities/content-tag.entity';
import { ContentStatus } from '../src/content/enums/content-status.enum';
import './matchers/db.matcher';

describe('Blogs (e2e)', () => {
  let app: INestApplication;
  let orm: MikroORM;
  let em: EntityManager;
  let accessToken: string;
  let userId: string;

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
        email: 'bloguser@example.com',
        password: 'BlogPass123!',
        firstName: 'Blog',
        lastName: 'User',
      });
    accessToken = response.body.accessToken;
    userId = response.body.user.id;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // =========================================
  // POST /blogs - Create Blog
  // =========================================

  describe('POST /blogs', () => {
    it('should return 201 and create blog with valid data', async () => {
      const response = await request(app.getHttpServer())
        .post('/blogs')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'My First Blog Post',
          slug: 'my-first-blog-post',
          body: 'This is the content of my first blog post.',
          excerpt: 'A brief introduction',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        contentType: 'blog',
        status: 'draft',
        slug: 'my-first-blog-post',
        locale: 'en',
        version: 1,
        isLatest: true,
        title: 'My First Blog Post',
        body: 'This is the content of my first blog post.',
        excerpt: 'A brief introduction',
        isFeatured: false,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      // Database validation
      await expect({ entity: Content, id: response.body.id }).toMatchInDb(em, {
        slug: 'my-first-blog-post',
        status: ContentStatus.DRAFT,
      });
    });

    it('should create blog with tags', async () => {
      // First create tags
      const tag1 = await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Tech', slug: 'tech' });

      const tag2 = await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Tutorial', slug: 'tutorial' });

      const response = await request(app.getHttpServer())
        .post('/blogs')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Blog With Tags',
          slug: 'blog-with-tags',
          body: 'Content here',
          tagIds: [tag1.body.id, tag2.body.id],
        })
        .expect(201);

      expect(response.body.tags).toHaveLength(2);
      expect(response.body.tags.map((t: Tag) => t.name)).toContain('Tech');
      expect(response.body.tags.map((t: Tag) => t.name)).toContain('Tutorial');
    });

    it('should return 400 when title is missing', async () => {
      const response = await request(app.getHttpServer())
        .post('/blogs')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          slug: 'no-title',
          body: 'Content',
        })
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([expect.stringMatching(/title/)]),
      );
    });

    it('should return 400 when slug is missing', async () => {
      await request(app.getHttpServer())
        .post('/blogs')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'No Slug',
          body: 'Content',
        })
        .expect(400);
    });

    it('should return 400 when body is missing', async () => {
      await request(app.getHttpServer())
        .post('/blogs')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'No Body',
          slug: 'no-body',
        })
        .expect(400);
    });

    it('should return 400 with invalid slug format', async () => {
      await request(app.getHttpServer())
        .post('/blogs')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Invalid Slug',
          slug: 'Invalid Slug',
          body: 'Content',
        })
        .expect(400);
    });

    it('should return 409 when slug already exists', async () => {
      await request(app.getHttpServer())
        .post('/blogs')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Duplicate Blog',
          slug: 'duplicate-blog',
          body: 'Content',
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/blogs')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Duplicate Blog 2',
          slug: 'duplicate-blog',
          body: 'Different content',
        })
        .expect(409);

      expect(response.body.message).toMatch(/slug|exists|conflict/i);
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .post('/blogs')
        .send({
          title: 'Unauth Blog',
          slug: 'unauth-blog',
          body: 'Content',
        })
        .expect(401);
    });
  });

  // =========================================
  // GET /blogs - List Blogs
  // =========================================

  describe('GET /blogs', () => {
    beforeAll(async () => {
      // Create some blogs for testing
      const blogs = [
        { title: 'JavaScript Basics', slug: 'javascript-basics', body: 'Learn JS', isFeatured: true },
        { title: 'TypeScript Guide', slug: 'typescript-guide', body: 'Learn TS', isFeatured: false },
        { title: 'NestJS Tutorial', slug: 'nestjs-tutorial', body: 'Learn NestJS', isFeatured: true },
      ];

      for (const blog of blogs) {
        await request(app.getHttpServer())
          .post('/blogs')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(blog);
      }
    });

    it('should return 200 with paginated list of blogs', async () => {
      const response = await request(app.getHttpServer())
        .get('/blogs')
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
        contentType: 'blog',
        title: expect.any(String),
        body: expect.any(String),
      });
    });

    it('should filter by isFeatured', async () => {
      const response = await request(app.getHttpServer())
        .get('/blogs?isFeatured=true')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      response.body.data.forEach((blog: any) => {
        expect(blog.isFeatured).toBe(true);
      });
    });

    it('should filter by search term', async () => {
      const response = await request(app.getHttpServer())
        .get('/blogs?search=script')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      response.body.data.forEach((blog: any) => {
        expect(
          blog.title.toLowerCase().includes('script') ||
          blog.slug.toLowerCase().includes('script')
        ).toBe(true);
      });
    });

    it('should support pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/blogs?page=1&limit=2')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(2);
      expect(response.body.meta.limit).toBe(2);
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer()).get('/blogs').expect(401);
    });
  });

  // =========================================
  // GET /blogs/:id - Get Blog by ID
  // =========================================

  describe('GET /blogs/:id', () => {
    let testBlogId: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/blogs')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Get By ID Blog',
          slug: 'get-by-id-blog',
          body: 'Content for get by id test',
        });
      testBlogId = response.body.id;
    });

    it('should return 200 with blog details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/blogs/${testBlogId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testBlogId,
        contentType: 'blog',
        title: 'Get By ID Blog',
        slug: 'get-by-id-blog',
        body: 'Content for get by id test',
      });
    });

    it('should return 404 for non-existent blog', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .get(`/blogs/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 400 for invalid UUID format', async () => {
      await request(app.getHttpServer())
        .get('/blogs/invalid-uuid')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .get(`/blogs/${testBlogId}`)
        .expect(401);
    });
  });

  // =========================================
  // PATCH /blogs/:id - Update Blog
  // =========================================

  describe('PATCH /blogs/:id', () => {
    let testBlogId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/blogs')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: `Update Blog ${Date.now()}`,
          slug: `update-blog-${Date.now()}`,
          body: 'Original content',
        });
      testBlogId = response.body.id;
    });

    it('should return 200 and update blog title', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/blogs/${testBlogId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Updated Title',
        })
        .expect(200);

      expect(response.body.title).toBe('Updated Title');

      // Database validation
      const blog = await em.findOne(Blog, { content: { id: testBlogId } });
      expect(blog?.title).toBe('Updated Title');
    });

    it('should update blog body', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/blogs/${testBlogId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          body: 'Updated content',
        })
        .expect(200);

      expect(response.body.body).toBe('Updated content');
    });

    it('should return 409 when updating to existing slug', async () => {
      // Create another blog
      await request(app.getHttpServer())
        .post('/blogs')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Existing Slug Blog',
          slug: 'existing-slug-blog',
          body: 'Content',
        });

      await request(app.getHttpServer())
        .patch(`/blogs/${testBlogId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          slug: 'existing-slug-blog',
        })
        .expect(409);
    });

    it('should return 404 for non-existent blog', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .patch(`/blogs/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Updated' })
        .expect(404);
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .patch(`/blogs/${testBlogId}`)
        .send({ title: 'Updated' })
        .expect(401);
    });
  });

  // =========================================
  // PATCH /blogs/:id - Publish Blog (Auto-Version)
  // =========================================

  describe('PATCH /blogs/:id - Publish', () => {
    let testBlogId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/blogs')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: `Publish Blog ${Date.now()}`,
          slug: `publish-blog-${Date.now()}`,
          body: 'Content to publish',
        });
      testBlogId = response.body.id;
    });

    it('should auto-create version when publishing', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/blogs/${testBlogId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: 'published',
        })
        .expect(200);

      expect(response.body.status).toBe('published');
      expect(response.body.publishedAt).toBeTruthy();

      // Check version was created
      const versionsResponse = await request(app.getHttpServer())
        .get(`/contents/${testBlogId}/versions`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(versionsResponse.body.data.length).toBeGreaterThanOrEqual(1);
      expect(versionsResponse.body.data[0].changeSummary).toMatch(/publish/i);
    });
  });

  // =========================================
  // DELETE /blogs/:id - Soft Delete Blog
  // =========================================

  describe('DELETE /blogs/:id', () => {
    let blogToDeleteId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/blogs')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: `Delete Blog ${Date.now()}`,
          slug: `delete-blog-${Date.now()}`,
          body: 'Content to delete',
        });
      blogToDeleteId = response.body.id;
    });

    it('should return 204 and soft delete the blog', async () => {
      await request(app.getHttpServer())
        .delete(`/blogs/${blogToDeleteId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      // Verify soft delete (deletedAt is set)
      const content = await em.findOne(Content, { id: blogToDeleteId });
      expect(content?.deletedAt).toBeTruthy();

      // Verify GET returns 404
      await request(app.getHttpServer())
        .get(`/blogs/${blogToDeleteId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 404 when deleting non-existent blog', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .delete(`/blogs/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .delete(`/blogs/${blogToDeleteId}`)
        .expect(401);
    });
  });

  // =========================================
  // Blog Tags Management
  // =========================================

  describe('Blog Tags', () => {
    let testBlogId: string;
    let testTagId1: string;
    let testTagId2: string;

    beforeAll(async () => {
      // Create tags
      const tag1 = await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'BlogTag1', slug: 'blog-tag-1' });
      testTagId1 = tag1.body.id;

      const tag2 = await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'BlogTag2', slug: 'blog-tag-2' });
      testTagId2 = tag2.body.id;

      // Create blog
      const blog = await request(app.getHttpServer())
        .post('/blogs')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Blog For Tags Test',
          slug: 'blog-for-tags-test',
          body: 'Content',
        });
      testBlogId = blog.body.id;
    });

    describe('POST /blogs/:id/tags', () => {
      it('should add tags to blog', async () => {
        const response = await request(app.getHttpServer())
          .post(`/blogs/${testBlogId}/tags`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ tagIds: [testTagId1, testTagId2] })
          .expect(200);

        expect(response.body.data).toHaveLength(2);

        // Database validation
        await expect({
          entity: ContentTag,
          where: { content: { id: testBlogId }, tag: { id: testTagId1 } },
        }).toExistInDb(em);
      });

      it('should return 404 for non-existent blog', async () => {
        const nonExistentId = '00000000-0000-0000-0000-000000000000';
        await request(app.getHttpServer())
          .post(`/blogs/${nonExistentId}/tags`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ tagIds: [testTagId1] })
          .expect(404);
      });
    });

    describe('GET /blogs/:id/tags', () => {
      it('should return tags for blog', async () => {
        const response = await request(app.getHttpServer())
          .get(`/blogs/${testBlogId}/tags`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body.data).toBeInstanceOf(Array);
        expect(response.body.data.length).toBeGreaterThanOrEqual(2);
      });
    });

    describe('DELETE /blogs/:id/tags', () => {
      it('should remove tags from blog', async () => {
        const response = await request(app.getHttpServer())
          .delete(`/blogs/${testBlogId}/tags`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ tagIds: [testTagId1] })
          .expect(200);

        // Should have 1 less tag
        const remainingTags = response.body.data.filter(
          (t: Tag) => t.id === testTagId1,
        );
        expect(remainingTags).toHaveLength(0);
      });
    });
  });
});
