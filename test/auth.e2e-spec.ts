import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { EntityManager, MikroORM } from '@mikro-orm/core';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { User } from '../src/auth/entities/user.entity';
import { Session } from '../src/auth/entities/session.entity';
import './matchers/db.matcher';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let orm: MikroORM;
  let em: EntityManager;

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
    em = orm.em.fork();
    await orm.schema.refreshDatabase();

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

      // Database validation: verify user was created correctly
      const userId = response.body.user.id;
      await expect({ entity: User, id: userId }).toMatchInDb(em, {
        email: validUser.email,
        firstName: validUser.firstName,
        lastName: validUser.lastName,
        isActive: true,
      });

      // Database validation: verify session was created
      await expect({
        entity: Session,
        where: { user: { id: userId } },
      }).toExistInDb(em);
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
      // Get session count before login
      em.clear();
      const userBefore = await em.findOne(User, { email: testUser.email });
      const sessionCountBefore = await em.count(Session, {
        user: { id: userBefore!.id },
      });

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

      // Database validation: verify new session was created
      em.clear();
      const sessionCountAfter = await em.count(Session, {
        user: { id: userBefore!.id },
      });
      expect(sessionCountAfter).toBe(sessionCountBefore + 1);

      // Database validation: verify lastLoginAt was updated
      await expect({ entity: User, id: userBefore!.id }).toMatchInDb(em, {
        lastLoginAt: expect.any(Date),
      });
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
    let userId: string;

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
      userId = response.body.user.id;
    });

    it('should return 200 with valid refresh token cookie', async () => {
      // Get session tokenHash before refresh for comparison
      em.clear();
      const sessionBefore = await em.findOne(Session, { user: { id: userId } });
      const tokenHashBefore = sessionBefore!.tokenHash;

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

      // Database validation: verify session exists with rotated token
      await expect({
        entity: Session,
        where: { user: { id: userId } },
      }).toExistInDb(em);

      // Verify token was rotated (different from before)
      em.clear();
      const sessionAfter = await em.findOne(Session, { user: { id: userId } });
      expect(sessionAfter!.tokenHash).not.toBe(tokenHashBefore);

      // Update cookie for subsequent tests
      refreshTokenCookie = cookies[0];
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
    let userId: string;

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
      userId = response.body.user.id;
    });

    it('should return 200 and clear cookie when logged in', async () => {
      // Verify session exists before logout
      await expect({
        entity: Session,
        where: { user: { id: userId } },
      }).toExistInDb(em);

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

      // Database validation: verify session was deleted
      await expect({
        entity: Session,
        where: { user: { id: userId } },
      }).toNotExistInDb(em);
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

      // Database validation: verify session was created after login
      await expect({
        entity: Session,
        where: { user: { id: userId } },
      }).toExistInDb(em);

      // Logout
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .set('Cookie', newRefreshCookie)
        .expect(200);

      // Database validation: verify session was deleted after logout
      await expect({
        entity: Session,
        where: { user: { id: userId } },
      }).toNotExistInDb(em);

      // Try to use old refresh token - should fail
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', newRefreshCookie)
        .expect(401);
    });
  });
});
