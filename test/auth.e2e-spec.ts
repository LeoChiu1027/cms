import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { MikroORM } from '@mikro-orm/core';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let orm: MikroORM;

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

    // Get ORM and create schema
    orm = moduleFixture.get<MikroORM>(MikroORM);
    await orm.schema.dropSchema();
    await orm.schema.createSchema();

    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('POST /auth/register', () => {
    const validUser = {
      email: 'test@example.com',
      password: 'SecurePass123!',
      firstName: 'John',
      lastName: 'Doe',
    };

    it('should return 201 and create user with valid data', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(validUser)
        .expect(201);

      expect(response.body).toMatchObject({
        accessToken: expect.any(String),
        expiresIn: expect.any(Number),
        user: {
          id: expect.any(String),
          email: validUser.email,
          firstName: validUser.firstName,
          lastName: validUser.lastName,
          isActive: true,
        },
      });

      // Should set refresh token cookie
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toMatch(/refresh_token=/);
      expect(cookies[0]).toMatch(/HttpOnly/);
    });

    it('should return 400 with invalid email format', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...validUser, email: 'invalid-email' })
        .expect(400);

      expect(response.body.message).toContain('email must be an email');
    });

    it('should return 400 with password too short', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...validUser, email: 'short@example.com', password: '123' })
        .expect(400);

      expect(response.body.message).toContain(
        'password must be longer than or equal to 8 characters',
      );
    });

    it('should return 409 when email already exists', async () => {
      // First registration
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...validUser, email: 'duplicate@example.com' })
        .expect(201);

      // Duplicate registration
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...validUser, email: 'duplicate@example.com' })
        .expect(409);

      expect(response.body.message).toMatch(/already exists/i);
    });
  });

  describe('POST /auth/login', () => {
    const testUser = {
      email: 'login-test@example.com',
      password: 'SecurePass123!',
    };

    beforeAll(async () => {
      // Create user for login tests
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...testUser, firstName: 'Login', lastName: 'Test' });
    });

    it('should return 200 with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(testUser)
        .expect(200);

      expect(response.body).toMatchObject({
        accessToken: expect.any(String),
        expiresIn: expect.any(Number),
        user: {
          email: testUser.email,
        },
      });

      // Should set refresh token cookie
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toMatch(/refresh_token=/);
    });

    it('should return 401 with wrong password', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ ...testUser, password: 'WrongPassword123!' })
        .expect(401);

      expect(response.body.message).toMatch(/invalid credentials/i);
    });

    it('should return 401 when user not found', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'SomePass123!' })
        .expect(401);

      expect(response.body.message).toMatch(/invalid credentials/i);
    });
  });

  describe('POST /auth/refresh', () => {
    let refreshTokenCookie: string;

    beforeAll(async () => {
      // Create user and get refresh token
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'refresh-test@example.com',
          password: 'SecurePass123!',
          firstName: 'Refresh',
          lastName: 'Test',
        });

      refreshTokenCookie = response.headers['set-cookie'][0];
    });

    it('should return 200 with valid refresh token cookie', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', refreshTokenCookie)
        .expect(200);

      expect(response.body).toMatchObject({
        accessToken: expect.any(String),
        expiresIn: expect.any(Number),
        user: {
          email: 'refresh-test@example.com',
        },
      });

      // Should set new refresh token cookie (rotation)
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toMatch(/refresh_token=/);
    });

    it('should return 401 without refresh token cookie', async () => {
      await request(app.getHttpServer()).post('/auth/refresh').expect(401);
    });

    it('should return 401 with invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', 'refresh_token=invalid-token')
        .expect(401);
    });
  });

  describe('GET /auth/me', () => {
    let accessToken: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'me-test@example.com',
          password: 'SecurePass123!',
          firstName: 'Me',
          lastName: 'Test',
        });

      accessToken = response.body.accessToken;
    });

    it('should return 200 with valid access token', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        email: 'me-test@example.com',
        firstName: 'Me',
        lastName: 'Test',
        isActive: true,
      });

      // Should not include password hash
      expect(response.body.passwordHash).toBeUndefined();
    });

    it('should return 401 without access token', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('should return 401 with invalid access token', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    let accessToken: string;
    let refreshTokenCookie: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'logout-test@example.com',
          password: 'SecurePass123!',
          firstName: 'Logout',
          lastName: 'Test',
        });

      accessToken = response.body.accessToken;
      refreshTokenCookie = response.headers['set-cookie'][0];
    });

    it('should return 200 and clear cookie when logged in', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', refreshTokenCookie)
        .expect(200);

      expect(response.body).toMatchObject({
        message: expect.stringMatching(/logged out/i),
      });

      // Should clear refresh token cookie
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toMatch(/refresh_token=;/);
      expect(cookies[0]).toMatch(/Max-Age=0/i);
    });

    it('should return 401 without access token', async () => {
      await request(app.getHttpServer()).post('/auth/logout').expect(401);
    });

    it('should invalidate refresh token after logout', async () => {
      // Login to get new tokens
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'logout-test@example.com',
          password: 'SecurePass123!',
        });

      const newAccessToken = loginResponse.body.accessToken;
      const newRefreshCookie = loginResponse.headers['set-cookie'][0];

      // Logout
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .set('Cookie', newRefreshCookie)
        .expect(200);

      // Try to use old refresh token - should fail
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', newRefreshCookie)
        .expect(401);
    });
  });
});
