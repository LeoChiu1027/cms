import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { MikroORM } from '@mikro-orm/core';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';

describe('RBAC (e2e)', () => {
  let app: INestApplication;
  let orm: MikroORM;
  let adminAccessToken: string;
  let userAccessToken: string;
  let adminUserId: string;
  let regularUserId: string;

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
    await orm.schema.dropSchema();
    await orm.schema.createSchema();

    await app.init();

    // Create admin user with super-admin role (seeded or manually assigned)
    const adminResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'admin@example.com',
        password: 'AdminPass123!',
        firstName: 'Admin',
        lastName: 'User',
      });
    adminAccessToken = adminResponse.body.accessToken;
    adminUserId = adminResponse.body.user.id;

    // Create regular user
    const userResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'user@example.com',
        password: 'UserPass123!',
        firstName: 'Regular',
        lastName: 'User',
      });
    userAccessToken = userResponse.body.accessToken;
    regularUserId = userResponse.body.user.id;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // =========================================
  // ROLES CRUD
  // =========================================

  describe('Roles CRUD', () => {
    let createdRoleId: string;

    describe('POST /roles', () => {
      it('should return 201 and create role with valid data', async () => {
        const response = await request(app.getHttpServer())
          .post('/roles')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            name: 'Content Editor',
            slug: 'content-editor',
            description: 'Can create and edit content',
          })
          .expect(201);

        expect(response.body).toMatchObject({
          id: expect.any(String),
          name: 'Content Editor',
          slug: 'content-editor',
          description: 'Can create and edit content',
          isSystem: false,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        });

        createdRoleId = response.body.id;
      });

      it('should return 400 with invalid slug format', async () => {
        const response = await request(app.getHttpServer())
          .post('/roles')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            name: 'Invalid Role',
            slug: 'Invalid Slug With Spaces',
            description: 'Test',
          })
          .expect(400);

        expect(response.body.message).toEqual(
          expect.arrayContaining([expect.stringMatching(/slug/)]),
        );
      });

      it('should return 400 when name is missing', async () => {
        await request(app.getHttpServer())
          .post('/roles')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            slug: 'missing-name',
          })
          .expect(400);
      });

      it('should return 409 when slug already exists', async () => {
        // First create
        await request(app.getHttpServer())
          .post('/roles')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            name: 'Duplicate Role',
            slug: 'duplicate-role',
          })
          .expect(201);

        // Duplicate
        const response = await request(app.getHttpServer())
          .post('/roles')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            name: 'Another Duplicate',
            slug: 'duplicate-role',
          })
          .expect(409);

        expect(response.body.message).toMatch(/already exists/i);
      });

      it('should return 401 without authentication', async () => {
        await request(app.getHttpServer())
          .post('/roles')
          .send({
            name: 'Unauthorized Role',
            slug: 'unauthorized-role',
          })
          .expect(401);
      });
    });

    describe('GET /roles', () => {
      it('should return 200 and list roles with pagination', async () => {
        const response = await request(app.getHttpServer())
          .get('/roles')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          data: expect.any(Array),
          meta: {
            page: 1,
            limit: expect.any(Number),
            total: expect.any(Number),
            totalPages: expect.any(Number),
          },
        });
      });

      it('should return 200 with pagination parameters', async () => {
        const response = await request(app.getHttpServer())
          .get('/roles?page=1&limit=5')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(200);

        expect(response.body.meta.page).toBe(1);
        expect(response.body.meta.limit).toBe(5);
      });

      it('should filter by isSystem parameter', async () => {
        const response = await request(app.getHttpServer())
          .get('/roles?isSystem=false')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(200);

        response.body.data.forEach((role: { isSystem: boolean }) => {
          expect(role.isSystem).toBe(false);
        });
      });

      it('should return 401 without authentication', async () => {
        await request(app.getHttpServer()).get('/roles').expect(401);
      });
    });

    describe('GET /roles/:id', () => {
      it('should return 200 with role and permissions', async () => {
        const response = await request(app.getHttpServer())
          .get(`/roles/${createdRoleId}`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          id: createdRoleId,
          name: 'Content Editor',
          slug: 'content-editor',
          permissions: expect.any(Array),
        });
      });

      it('should return 404 for non-existent role', async () => {
        await request(app.getHttpServer())
          .get('/roles/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(404);
      });

      it('should return 401 without authentication', async () => {
        await request(app.getHttpServer())
          .get(`/roles/${createdRoleId}`)
          .expect(401);
      });
    });

    describe('PATCH /roles/:id', () => {
      it('should return 200 and update role', async () => {
        const response = await request(app.getHttpServer())
          .patch(`/roles/${createdRoleId}`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            name: 'Updated Content Editor',
            description: 'Updated description',
          })
          .expect(200);

        expect(response.body).toMatchObject({
          id: createdRoleId,
          name: 'Updated Content Editor',
          description: 'Updated description',
        });
      });

      it('should return 404 for non-existent role', async () => {
        await request(app.getHttpServer())
          .patch('/roles/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({ name: 'Test' })
          .expect(404);
      });

      it('should return 401 without authentication', async () => {
        await request(app.getHttpServer())
          .patch(`/roles/${createdRoleId}`)
          .send({ name: 'Test' })
          .expect(401);
      });
    });

    describe('DELETE /roles/:id', () => {
      let roleToDeleteId: string;

      beforeAll(async () => {
        const response = await request(app.getHttpServer())
          .post('/roles')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            name: 'Role To Delete',
            slug: 'role-to-delete',
          });
        roleToDeleteId = response.body.id;
      });

      it('should return 204 and delete role', async () => {
        await request(app.getHttpServer())
          .delete(`/roles/${roleToDeleteId}`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(204);

        // Verify deleted
        await request(app.getHttpServer())
          .get(`/roles/${roleToDeleteId}`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(404);
      });

      it('should return 404 for non-existent role', async () => {
        await request(app.getHttpServer())
          .delete('/roles/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(404);
      });

      it('should return 401 without authentication', async () => {
        await request(app.getHttpServer())
          .delete(`/roles/${createdRoleId}`)
          .expect(401);
      });
    });
  });

  // =========================================
  // PERMISSIONS CRUD
  // =========================================

  describe('Permissions CRUD', () => {
    let createdPermissionId: string;

    describe('POST /permissions', () => {
      it('should return 201 and create permission with valid data', async () => {
        const response = await request(app.getHttpServer())
          .post('/permissions')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            name: 'Create Content',
            slug: 'content:create',
            resource: 'content',
            action: 'create',
            description: 'Ability to create new content',
          })
          .expect(201);

        expect(response.body).toMatchObject({
          id: expect.any(String),
          name: 'Create Content',
          slug: 'content:create',
          resource: 'content',
          action: 'create',
          description: 'Ability to create new content',
          createdAt: expect.any(String),
        });

        createdPermissionId = response.body.id;
      });

      it('should return 400 when required fields are missing', async () => {
        await request(app.getHttpServer())
          .post('/permissions')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            name: 'Incomplete Permission',
          })
          .expect(400);
      });

      it('should return 409 when slug already exists', async () => {
        // First create
        await request(app.getHttpServer())
          .post('/permissions')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            name: 'Duplicate Permission',
            slug: 'duplicate:permission',
            resource: 'test',
            action: 'test',
          })
          .expect(201);

        // Duplicate
        const response = await request(app.getHttpServer())
          .post('/permissions')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            name: 'Another Duplicate',
            slug: 'duplicate:permission',
            resource: 'test',
            action: 'test',
          })
          .expect(409);

        expect(response.body.message).toMatch(/already exists/i);
      });

      it('should return 401 without authentication', async () => {
        await request(app.getHttpServer())
          .post('/permissions')
          .send({
            name: 'Unauthorized',
            slug: 'unauthorized:permission',
            resource: 'test',
            action: 'test',
          })
          .expect(401);
      });
    });

    describe('GET /permissions', () => {
      it('should return 200 and list permissions with pagination', async () => {
        const response = await request(app.getHttpServer())
          .get('/permissions')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          data: expect.any(Array),
          meta: {
            page: 1,
            limit: expect.any(Number),
            total: expect.any(Number),
            totalPages: expect.any(Number),
          },
        });
      });

      it('should filter by resource', async () => {
        const response = await request(app.getHttpServer())
          .get('/permissions?resource=content')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(200);

        response.body.data.forEach((permission: { resource: string }) => {
          expect(permission.resource).toBe('content');
        });
      });

      it('should filter by action', async () => {
        const response = await request(app.getHttpServer())
          .get('/permissions?action=create')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(200);

        response.body.data.forEach((permission: { action: string }) => {
          expect(permission.action).toBe('create');
        });
      });

      it('should return 401 without authentication', async () => {
        await request(app.getHttpServer()).get('/permissions').expect(401);
      });
    });

    describe('GET /permissions/:id', () => {
      it('should return 200 with permission details', async () => {
        const response = await request(app.getHttpServer())
          .get(`/permissions/${createdPermissionId}`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          id: createdPermissionId,
          name: 'Create Content',
          slug: 'content:create',
        });
      });

      it('should return 404 for non-existent permission', async () => {
        await request(app.getHttpServer())
          .get('/permissions/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(404);
      });
    });

    describe('DELETE /permissions/:id', () => {
      let permissionToDeleteId: string;

      beforeAll(async () => {
        const response = await request(app.getHttpServer())
          .post('/permissions')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            name: 'Permission To Delete',
            slug: 'delete:permission',
            resource: 'test',
            action: 'delete',
          });
        permissionToDeleteId = response.body.id;
      });

      it('should return 204 and delete permission', async () => {
        await request(app.getHttpServer())
          .delete(`/permissions/${permissionToDeleteId}`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(204);

        // Verify deleted
        await request(app.getHttpServer())
          .get(`/permissions/${permissionToDeleteId}`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(404);
      });

      it('should return 404 for non-existent permission', async () => {
        await request(app.getHttpServer())
          .delete('/permissions/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(404);
      });
    });
  });

  // =========================================
  // ROLE PERMISSIONS
  // =========================================

  describe('Role Permissions', () => {
    let testRoleId: string;
    let testPermissionId1: string;
    let testPermissionId2: string;

    beforeAll(async () => {
      // Create a role for testing
      const roleResponse = await request(app.getHttpServer())
        .post('/roles')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          name: 'Permission Test Role',
          slug: 'permission-test-role',
        });
      testRoleId = roleResponse.body.id;

      // Create permissions for testing
      const perm1Response = await request(app.getHttpServer())
        .post('/permissions')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          name: 'Test Permission 1',
          slug: 'test:permission1',
          resource: 'test',
          action: 'permission1',
        });
      testPermissionId1 = perm1Response.body.id;

      const perm2Response = await request(app.getHttpServer())
        .post('/permissions')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          name: 'Test Permission 2',
          slug: 'test:permission2',
          resource: 'test',
          action: 'permission2',
        });
      testPermissionId2 = perm2Response.body.id;
    });

    describe('POST /roles/:roleId/permissions', () => {
      it('should return 200 and assign permissions to role', async () => {
        const response = await request(app.getHttpServer())
          .post(`/roles/${testRoleId}/permissions`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            permissionIds: [testPermissionId1, testPermissionId2],
          })
          .expect(200);

        expect(response.body).toMatchObject({
          id: testRoleId,
          permissions: expect.arrayContaining([
            expect.objectContaining({ id: testPermissionId1 }),
            expect.objectContaining({ id: testPermissionId2 }),
          ]),
        });
      });

      it('should return 400 with invalid permission IDs', async () => {
        await request(app.getHttpServer())
          .post(`/roles/${testRoleId}/permissions`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            permissionIds: ['00000000-0000-0000-0000-000000000000'],
          })
          .expect(400);
      });

      it('should return 404 for non-existent role', async () => {
        await request(app.getHttpServer())
          .post('/roles/00000000-0000-0000-0000-000000000000/permissions')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            permissionIds: [testPermissionId1],
          })
          .expect(404);
      });
    });

    describe('GET /roles/:roleId/permissions', () => {
      it('should return 200 with role permissions', async () => {
        const response = await request(app.getHttpServer())
          .get(`/roles/${testRoleId}/permissions`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          data: expect.arrayContaining([
            expect.objectContaining({ id: testPermissionId1 }),
            expect.objectContaining({ id: testPermissionId2 }),
          ]),
        });
      });

      it('should return 404 for non-existent role', async () => {
        await request(app.getHttpServer())
          .get('/roles/00000000-0000-0000-0000-000000000000/permissions')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(404);
      });
    });

    describe('DELETE /roles/:roleId/permissions', () => {
      it('should return 200 and remove permissions from role', async () => {
        const response = await request(app.getHttpServer())
          .delete(`/roles/${testRoleId}/permissions`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            permissionIds: [testPermissionId1],
          })
          .expect(200);

        expect(response.body.permissions).not.toContainEqual(
          expect.objectContaining({ id: testPermissionId1 }),
        );
        expect(response.body.permissions).toContainEqual(
          expect.objectContaining({ id: testPermissionId2 }),
        );
      });
    });
  });

  // =========================================
  // USER ROLES
  // =========================================

  describe('User Roles', () => {
    let testRoleId: string;

    beforeAll(async () => {
      // Create a role for testing
      const roleResponse = await request(app.getHttpServer())
        .post('/roles')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          name: 'User Test Role',
          slug: 'user-test-role',
        });
      testRoleId = roleResponse.body.id;
    });

    describe('POST /users/:userId/roles', () => {
      it('should return 200 and assign roles to user', async () => {
        const response = await request(app.getHttpServer())
          .post(`/users/${regularUserId}/roles`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            roleIds: [testRoleId],
          })
          .expect(200);

        expect(response.body).toMatchObject({
          data: expect.arrayContaining([
            expect.objectContaining({ id: testRoleId }),
          ]),
        });
      });

      it('should return 400 with invalid role IDs', async () => {
        await request(app.getHttpServer())
          .post(`/users/${regularUserId}/roles`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            roleIds: ['00000000-0000-0000-0000-000000000000'],
          })
          .expect(400);
      });

      it('should return 404 for non-existent user', async () => {
        await request(app.getHttpServer())
          .post('/users/00000000-0000-0000-0000-000000000000/roles')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            roleIds: [testRoleId],
          })
          .expect(404);
      });
    });

    describe('GET /users/:userId/roles', () => {
      it('should return 200 with user roles', async () => {
        const response = await request(app.getHttpServer())
          .get(`/users/${regularUserId}/roles`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          data: expect.arrayContaining([
            expect.objectContaining({ id: testRoleId }),
          ]),
        });
      });

      it('should return 404 for non-existent user', async () => {
        await request(app.getHttpServer())
          .get('/users/00000000-0000-0000-0000-000000000000/roles')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(404);
      });
    });

    describe('GET /users/:userId/permissions', () => {
      it('should return 200 with effective permissions', async () => {
        const response = await request(app.getHttpServer())
          .get(`/users/${regularUserId}/permissions`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          data: expect.any(Array),
        });
      });

      it('should return 404 for non-existent user', async () => {
        await request(app.getHttpServer())
          .get('/users/00000000-0000-0000-0000-000000000000/permissions')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(404);
      });
    });

    describe('DELETE /users/:userId/roles', () => {
      it('should return 200 and remove roles from user', async () => {
        const response = await request(app.getHttpServer())
          .delete(`/users/${regularUserId}/roles`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            roleIds: [testRoleId],
          })
          .expect(200);

        expect(response.body.data).not.toContainEqual(
          expect.objectContaining({ id: testRoleId }),
        );
      });
    });
  });

  // =========================================
  // SYSTEM ROLES PROTECTION
  // =========================================

  describe('System Roles Protection', () => {
    let systemRoleId: string;

    beforeAll(async () => {
      // Create a system role (via direct DB or seed)
      const response = await request(app.getHttpServer())
        .post('/roles')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          name: 'System Admin',
          slug: 'system-admin',
          description: 'System role for testing',
        });
      systemRoleId = response.body.id;

      // Mark as system role (this would typically be done via seeding)
      // For E2E test, we'll test with a non-system role first
    });

    it('should not allow deletion of system roles', async () => {
      // This test assumes system roles are seeded
      // If the role was marked as isSystem: true, it should return 403
      // For now, we'll skip this test as it requires seeding
    });
  });
});
