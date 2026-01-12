import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { EntityManager, MikroORM } from '@mikro-orm/core';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { WorkflowConfig } from '../src/workflow/entities/workflow-config.entity';
import { EntityType } from '../src/workflow/enums/workflow.enum';
import './matchers/db.matcher';

describe('Workflow Config (e2e)', () => {
    let app: INestApplication;
    let orm: MikroORM;
    let em: EntityManager;
    let adminToken: string;

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

        // Create admin user
        const adminResponse = await request(app.getHttpServer())
            .post('/auth/register')
            .send({
                email: 'admin@example.com',
                password: 'Admin123!',
                firstName: 'Admin',
                lastName: 'User',
            });
        adminToken = adminResponse.body.accessToken;
    });

    afterAll(async () => {
        if (app) {
            await app.close();
        }
    });

    // =========================================
    // GET /workflows/config - List All Configs
    // =========================================

    describe('GET /workflows/config', () => {
        it('should return 200 with empty list initially', async () => {
            const response = await request(app.getHttpServer())
                .get('/workflows/config')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('data');
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        it('should return 401 without auth token', async () => {
            await request(app.getHttpServer())
                .get('/workflows/config')
                .expect(401);
        });
    });

    // =========================================
    // PATCH /workflows/config/:entityType - Upsert Config
    // =========================================

    describe('PATCH /workflows/config/:entityType', () => {
        it('should create config if not exists (upsert)', async () => {
            const response = await request(app.getHttpServer())
                .patch('/workflows/config/content')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    requiresApproval: true,
                    minApprovers: 2,
                    autoApproveForRoles: ['admin', 'editor'],
                })
                .expect(200);

            expect(response.body).toMatchObject({
                entityType: 'content',
                requiresApproval: true,
                minApprovers: 2,
                autoApproveForRoles: ['admin', 'editor'],
            });
            expect(response.body.id).toBeDefined();

            // Verify in database
            await expect({
                entity: WorkflowConfig,
                where: { entityType: EntityType.CONTENT },
            }).toMatchInDb(em, {
                requiresApproval: true,
                minApprovers: 2,
                autoApproveForRoles: ['admin', 'editor'],
            });
        });

        it('should update existing config', async () => {
            // First update
            await request(app.getHttpServer())
                .patch('/workflows/config/content')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ requiresApproval: true });

            // Second update
            const response = await request(app.getHttpServer())
                .patch('/workflows/config/content')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    requiresApproval: false,
                    minApprovers: 1,
                })
                .expect(200);

            expect(response.body.requiresApproval).toBe(false);
            expect(response.body.minApprovers).toBe(1);

            // Verify database was updated
            await expect({
                entity: WorkflowConfig,
                where: { entityType: EntityType.CONTENT },
            }).toMatchInDb(em, {
                requiresApproval: false,
                minApprovers: 1,
            });
        });

        it('should return 400 for invalid minApprovers', async () => {
            await request(app.getHttpServer())
                .patch('/workflows/config/content')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ minApprovers: 0 })
                .expect(400);
        });

        it('should return 400 for invalid autoApproveForRoles type', async () => {
            await request(app.getHttpServer())
                .patch('/workflows/config/content')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ autoApproveForRoles: 'not-an-array' })
                .expect(400);
        });

        it('should return 401 without auth token', async () => {
            await request(app.getHttpServer())
                .patch('/workflows/config/content')
                .send({ requiresApproval: false })
                .expect(401);
        });
    });

    // =========================================
    // GET /workflows/config/:entityType - Get Single Config
    // =========================================

    describe('GET /workflows/config/:entityType', () => {
        beforeAll(async () => {
            // Ensure config exists
            await request(app.getHttpServer())
                .patch('/workflows/config/content')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    requiresApproval: true,
                    minApprovers: 1,
                    autoApproveForRoles: ['admin'],
                    notifyOnSubmit: true,
                    notifyOnComplete: true,
                });
        });

        it('should return 200 with config for existing entityType', async () => {
            const response = await request(app.getHttpServer())
                .get('/workflows/config/content')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(response.body).toMatchObject({
                entityType: 'content',
                requiresApproval: true,
                minApprovers: 1,
                autoApproveForRoles: ['admin'],
                notifyOnSubmit: true,
                notifyOnComplete: true,
            });
        });

        it('should return 404 for non-existent entityType', async () => {
            await request(app.getHttpServer())
                .get('/workflows/config/nonexistent')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(404);
        });

        it('should return 401 without auth token', async () => {
            await request(app.getHttpServer())
                .get('/workflows/config/content')
                .expect(401);
        });
    });

    // =========================================
    // List All - With Data
    // =========================================

    describe('GET /workflows/config (with data)', () => {
        it('should return configs after creation', async () => {
            const response = await request(app.getHttpServer())
                .get('/workflows/config')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(response.body.data.length).toBeGreaterThan(0);
            expect(response.body.data[0]).toHaveProperty('entityType');
            expect(response.body.data[0]).toHaveProperty('requiresApproval');
            expect(response.body.data[0]).toHaveProperty('minApprovers');
        });
    });
});
