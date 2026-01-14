import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { EntityManager, MikroORM } from '@mikro-orm/core';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { Content } from '../src/content/entities/content.entity';
import { Product } from '../src/content/entities/product.entity';
import { Tag } from '../src/content/entities/tag.entity';
import { ContentTag } from '../src/content/entities/content-tag.entity';
import { ContentStatus } from '../src/content/enums/content-status.enum';
import './matchers/db.matcher';

describe('Products (e2e)', () => {
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
        email: 'productuser@example.com',
        password: 'ProductPass123!',
        firstName: 'Product',
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
  // POST /products - Create Product
  // =========================================

  describe('POST /products', () => {
    it('should return 201 and create product with valid data', async () => {
      const response = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test Product',
          slug: 'test-product',
          price: 99.99,
          description: 'A test product description',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        contentType: 'product',
        status: 'draft',
        slug: 'test-product',
        locale: 'en',
        version: 1,
        isLatest: true,
        name: 'Test Product',
        price: 99.99,
        description: 'A test product description',
        currency: 'USD',
        stockQuantity: 0,
        isFeatured: false,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      // Database validation
      await expect({ entity: Content, id: response.body.id }).toMatchInDb(em, {
        slug: 'test-product',
        status: ContentStatus.DRAFT,
      });
    });

    it('should create product with all optional fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Full Product',
          slug: 'full-product',
          description: 'Full description',
          shortDescription: 'Short desc',
          sku: 'SKU-001',
          price: 149.99,
          compareAtPrice: 199.99,
          currency: 'EUR',
          stockQuantity: 50,
          isFeatured: true,
          attributes: { color: 'red', size: 'large' },
          locale: 'en',
          seoTitle: 'Full Product SEO',
          seoDescription: 'SEO description',
          seoKeywords: 'product, full',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'Full Product',
        sku: 'SKU-001',
        price: 149.99,
        compareAtPrice: 199.99,
        currency: 'EUR',
        stockQuantity: 50,
        isFeatured: true,
        attributes: { color: 'red', size: 'large' },
      });

      // Database validation: verify product with all fields
      await expect({ entity: Product, where: { content: { id: response.body.id } } }).toMatchInDb(em, {
        name: 'Full Product',
        sku: 'SKU-001',
        price: '149.99', // DB stores decimal as string
        currency: 'EUR',
        stockQuantity: 50,
        isFeatured: true,
      });
    });

    it('should create product with tags', async () => {
      // First create tags
      const tag1 = await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Electronics', slug: 'electronics' });

      const tag2 = await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Sale', slug: 'sale' });

      const response = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Product With Tags',
          slug: 'product-with-tags',
          price: 29.99,
          tagIds: [tag1.body.id, tag2.body.id],
        })
        .expect(201);

      expect(response.body.tags).toHaveLength(2);
      expect(response.body.tags.map((t: Tag) => t.name)).toContain('Electronics');
      expect(response.body.tags.map((t: Tag) => t.name)).toContain('Sale');

      // Database validation: verify tag associations
      await expect({
        entity: ContentTag,
        where: { content: { id: response.body.id }, tag: { id: tag1.body.id } },
      }).toExistInDb(em);
      await expect({
        entity: ContentTag,
        where: { content: { id: response.body.id }, tag: { id: tag2.body.id } },
      }).toExistInDb(em);
    });

    it('should return 400 when name is missing', async () => {
      const response = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          slug: 'no-name',
          price: 10,
        })
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([expect.stringMatching(/name/)]),
      );
    });

    it('should return 400 when slug is missing', async () => {
      await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'No Slug Product',
          price: 10,
        })
        .expect(400);
    });

    it('should return 400 with invalid slug format', async () => {
      await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Invalid Slug',
          slug: 'Invalid Slug',
          price: 10,
        })
        .expect(400);
    });

    it('should return 400 with negative price', async () => {
      await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Negative Price',
          slug: 'negative-price',
          price: -10,
        })
        .expect(400);
    });

    it('should return 409 when slug already exists', async () => {
      await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Duplicate Product',
          slug: 'duplicate-product',
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Duplicate Product 2',
          slug: 'duplicate-product',
        })
        .expect(409);

      expect(response.body.message).toMatch(/slug|exists|conflict/i);
    });

    it('should return 409 when SKU already exists', async () => {
      await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Product SKU 1',
          slug: 'product-sku-1',
          sku: 'UNIQUE-SKU-001',
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Product SKU 2',
          slug: 'product-sku-2',
          sku: 'UNIQUE-SKU-001',
        })
        .expect(409);

      expect(response.body.message).toMatch(/sku|exists|conflict/i);
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .post('/products')
        .send({
          name: 'Unauth Product',
          slug: 'unauth-product',
        })
        .expect(401);
    });
  });

  // =========================================
  // GET /products - List Products
  // =========================================

  describe('GET /products', () => {
    beforeAll(async () => {
      // Create some products for testing
      const products = [
        { name: 'Laptop Pro', slug: 'laptop-pro', price: 999.99, isFeatured: true },
        { name: 'Wireless Mouse', slug: 'wireless-mouse', price: 29.99, isFeatured: false },
        { name: 'Mechanical Keyboard', slug: 'mechanical-keyboard', price: 149.99, isFeatured: true },
        { name: 'USB Cable', slug: 'usb-cable', price: 9.99, isFeatured: false },
      ];

      for (const product of products) {
        await request(app.getHttpServer())
          .post('/products')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(product);
      }
    });

    it('should return 200 with paginated list of products', async () => {
      const response = await request(app.getHttpServer())
        .get('/products')
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
        contentType: 'product',
        name: expect.any(String),
      });
    });

    it('should filter by isFeatured', async () => {
      const response = await request(app.getHttpServer())
        .get('/products?isFeatured=true')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      response.body.data.forEach((product: any) => {
        expect(product.isFeatured).toBe(true);
      });
    });

    it('should filter by minPrice', async () => {
      const response = await request(app.getHttpServer())
        .get('/products?minPrice=100')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      response.body.data.forEach((product: any) => {
        expect(product.price).toBeGreaterThanOrEqual(100);
      });
    });

    it('should filter by maxPrice', async () => {
      const response = await request(app.getHttpServer())
        .get('/products?maxPrice=50')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      response.body.data.forEach((product: any) => {
        expect(product.price).toBeLessThanOrEqual(50);
      });
    });

    it('should filter by price range', async () => {
      const response = await request(app.getHttpServer())
        .get('/products?minPrice=20&maxPrice=200')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      response.body.data.forEach((product: any) => {
        expect(product.price).toBeGreaterThanOrEqual(20);
        expect(product.price).toBeLessThanOrEqual(200);
      });
    });

    it('should filter by search term', async () => {
      const response = await request(app.getHttpServer())
        .get('/products?search=laptop')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      response.body.data.forEach((product: any) => {
        expect(
          product.name.toLowerCase().includes('laptop') ||
          product.slug.toLowerCase().includes('laptop')
        ).toBe(true);
      });
    });

    it('should support pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/products?page=1&limit=2')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(2);
      expect(response.body.meta.limit).toBe(2);
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer()).get('/products').expect(401);
    });
  });

  // =========================================
  // GET /products/:id - Get Product by ID
  // =========================================

  describe('GET /products/:id', () => {
    let testProductId: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Get By ID Product',
          slug: 'get-by-id-product',
          price: 59.99,
          description: 'Product for get by id test',
        });
      testProductId = response.body.id;
    });

    it('should return 200 with product details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/products/${testProductId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testProductId,
        contentType: 'product',
        name: 'Get By ID Product',
        slug: 'get-by-id-product',
        price: 59.99,
        description: 'Product for get by id test',
      });
    });

    it('should return 404 for non-existent product', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .get(`/products/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 400 for invalid UUID format', async () => {
      await request(app.getHttpServer())
        .get('/products/invalid-uuid')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .get(`/products/${testProductId}`)
        .expect(401);
    });
  });

  // =========================================
  // PATCH /products/:id - Update Product
  // =========================================

  describe('PATCH /products/:id', () => {
    let testProductId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: `Update Product ${Date.now()}`,
          slug: `update-product-${Date.now()}`,
          price: 39.99,
        });
      testProductId = response.body.id;
    });

    it('should return 200 and update product name', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/products/${testProductId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Updated Product Name',
        })
        .expect(200);

      expect(response.body.name).toBe('Updated Product Name');

      // Database validation
      await expect({ entity: Product, where: { content: { id: testProductId } } }).toMatchInDb(em, {
        name: 'Updated Product Name',
      });
    });

    it('should update product price', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/products/${testProductId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          price: 79.99,
        })
        .expect(200);

      expect(response.body.price).toBe(79.99);

      // Database validation
      await expect({ entity: Product, where: { content: { id: testProductId } } }).toMatchInDb(em, {
        price: '79.99', // DB stores decimal as string
      });
    });

    it('should update product stock and featured status', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/products/${testProductId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          stockQuantity: 100,
          isFeatured: true,
        })
        .expect(200);

      expect(response.body.stockQuantity).toBe(100);
      expect(response.body.isFeatured).toBe(true);

      // Database validation
      await expect({ entity: Product, where: { content: { id: testProductId } } }).toMatchInDb(em, {
        stockQuantity: 100,
        isFeatured: true,
      });
    });

    it('should update product attributes', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/products/${testProductId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          attributes: { color: 'blue', material: 'metal' },
        })
        .expect(200);

      expect(response.body.attributes).toEqual({ color: 'blue', material: 'metal' });

      // Database validation
      await expect({ entity: Product, where: { content: { id: testProductId } } }).toMatchInDb(em, {
        attributes: { color: 'blue', material: 'metal' },
      });
    });

    it('should return 409 when updating to existing slug', async () => {
      // Create another product
      await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Existing Slug Product',
          slug: 'existing-slug-product',
        });

      await request(app.getHttpServer())
        .patch(`/products/${testProductId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          slug: 'existing-slug-product',
        })
        .expect(409);
    });

    it('should return 409 when updating to existing SKU', async () => {
      // Create another product with SKU
      await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Existing SKU Product',
          slug: 'existing-sku-product',
          sku: 'EXISTING-SKU',
        });

      await request(app.getHttpServer())
        .patch(`/products/${testProductId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          sku: 'EXISTING-SKU',
        })
        .expect(409);
    });

    it('should return 404 for non-existent product', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .patch(`/products/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated' })
        .expect(404);
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .patch(`/products/${testProductId}`)
        .send({ name: 'Updated' })
        .expect(401);
    });
  });

  // =========================================
  // PATCH /products/:id - Publish Product (Auto-Version)
  // =========================================

  describe('PATCH /products/:id - Publish', () => {
    let testProductId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: `Publish Product ${Date.now()}`,
          slug: `publish-product-${Date.now()}`,
          price: 49.99,
        });
      testProductId = response.body.id;
    });

    it('should auto-create version when publishing', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/products/${testProductId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: 'published',
        })
        .expect(200);

      expect(response.body.status).toBe('published');
      expect(response.body.publishedAt).toBeTruthy();

      // Check version was created
      const versionsResponse = await request(app.getHttpServer())
        .get(`/contents/${testProductId}/versions`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(versionsResponse.body.data.length).toBeGreaterThanOrEqual(1);
      expect(versionsResponse.body.data[0].changeSummary).toMatch(/publish/i);
    });
  });

  // =========================================
  // DELETE /products/:id - Soft Delete Product
  // =========================================

  describe('DELETE /products/:id', () => {
    let productToDeleteId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: `Delete Product ${Date.now()}`,
          slug: `delete-product-${Date.now()}`,
          price: 19.99,
        });
      productToDeleteId = response.body.id;
    });

    it('should return 204 and soft delete the product', async () => {
      await request(app.getHttpServer())
        .delete(`/products/${productToDeleteId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      // Database validation: verify soft delete (deletedAt is set)
      await expect({ entity: Content, id: productToDeleteId }).toMatchInDb(em, {
        deletedAt: expect.any(Date),
      });

      // Verify GET returns 404
      await request(app.getHttpServer())
        .get(`/products/${productToDeleteId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 404 when deleting non-existent product', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .delete(`/products/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .delete(`/products/${productToDeleteId}`)
        .expect(401);
    });
  });

  // =========================================
  // Product Tags Management
  // =========================================

  describe('Product Tags', () => {
    let testProductId: string;
    let testTagId1: string;
    let testTagId2: string;

    beforeAll(async () => {
      // Create tags
      const tag1 = await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'ProductTag1', slug: 'product-tag-1' });
      testTagId1 = tag1.body.id;

      const tag2 = await request(app.getHttpServer())
        .post('/tags')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'ProductTag2', slug: 'product-tag-2' });
      testTagId2 = tag2.body.id;

      // Create product
      const product = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Product For Tags Test',
          slug: 'product-for-tags-test',
          price: 99.99,
        });
      testProductId = product.body.id;
    });

    describe('POST /products/:id/tags', () => {
      it('should add tags to product', async () => {
        const response = await request(app.getHttpServer())
          .post(`/products/${testProductId}/tags`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ tagIds: [testTagId1, testTagId2] })
          .expect(200);

        expect(response.body.data).toHaveLength(2);

        // Database validation
        await expect({
          entity: ContentTag,
          where: { content: { id: testProductId }, tag: { id: testTagId1 } },
        }).toExistInDb(em);
      });

      it('should return 404 for non-existent product', async () => {
        const nonExistentId = '00000000-0000-0000-0000-000000000000';
        await request(app.getHttpServer())
          .post(`/products/${nonExistentId}/tags`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ tagIds: [testTagId1] })
          .expect(404);
      });
    });

    describe('GET /products/:id/tags', () => {
      it('should return tags for product', async () => {
        const response = await request(app.getHttpServer())
          .get(`/products/${testProductId}/tags`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body.data).toBeInstanceOf(Array);
        expect(response.body.data.length).toBeGreaterThanOrEqual(2);
      });
    });

    describe('DELETE /products/:id/tags', () => {
      it('should remove tags from product', async () => {
        const response = await request(app.getHttpServer())
          .delete(`/products/${testProductId}/tags`)
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
