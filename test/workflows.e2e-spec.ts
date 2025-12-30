import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { EntityManager, MikroORM } from '@mikro-orm/core';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { Workflow } from '../src/workflow/entities/workflow.entity';
import { Approval } from '../src/workflow/entities/approval.entity';
import { EntityType, WorkflowStatus, WorkflowOperation, ApprovalAction } from '../src/workflow/enums/workflow.enum';
import './matchers/db.matcher';

describe('Workflows (e2e)', () => {
    let app: INestApplication;
    let orm: MikroORM;
    let em: EntityManager;
    let creatorToken: string;
    let creatorId: string;
    let reviewerToken: string;
    let reviewerId: string;

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

        // Create two users: creator and reviewer
        const creatorResponse = await request(app.getHttpServer())
            .post('/auth/register')
            .send({
                email: 'creator@example.com',
                password: 'Creator123!',
                firstName: 'Content',
                lastName: 'Creator',
            });
        creatorToken = creatorResponse.body.accessToken;
        creatorId = creatorResponse.body.user.id;

        const reviewerResponse = await request(app.getHttpServer())
            .post('/auth/register')
            .send({
                email: 'reviewer@example.com',
                password: 'Reviewer123!',
                firstName: 'Content',
                lastName: 'Reviewer',
            });
        reviewerToken = reviewerResponse.body.accessToken;
        reviewerId = reviewerResponse.body.user.id;
    });

    afterAll(async () => {
        if (app) {
            await app.close();
        }
    });

    // =========================================
    // POST /workflows - Create Workflow
    // =========================================

    describe('POST /workflows', () => {
        it('should return 201 and create workflow with valid data', async () => {
            const payload = {
                contentType: 'blog',
                title: 'New Blog Post',
                slug: 'new-blog-post',
                body: 'Blog content here',
            };

            const response = await request(app.getHttpServer())
                .post('/workflows')
                .set('Authorization', `Bearer ${creatorToken}`)
                .send({
                    entityType: 'content',
                    operation: 'create',
                    payload,
                })
                .expect(201);

            expect(response.body).toMatchObject({
                id: expect.any(String),
                entityType: 'content',
                operation: 'create',
                payload,
                currentStatus: 'draft',
                createdBy: creatorId,
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
            });

            // Database validation
            await expect({ entity: Workflow, id: response.body.id }).toMatchInDb(em, {
                currentStatus: WorkflowStatus.DRAFT,
                operation: WorkflowOperation.CREATE,
            });
        });

        it('should create workflow with entityId for update operation', async () => {
            const entityId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'; // Valid UUID v4
            const response = await request(app.getHttpServer())
                .post('/workflows')
                .set('Authorization', `Bearer ${creatorToken}`)
                .send({
                    entityType: 'content',
                    entityId,
                    operation: 'update',
                    payload: { title: 'Updated Title' },
                })
                .expect(201);

            expect(response.body.entityId).toBe(entityId);
            expect(response.body.operation).toBe('update');
        });

        it('should return 400 when entityType is missing', async () => {
            await request(app.getHttpServer())
                .post('/workflows')
                .set('Authorization', `Bearer ${creatorToken}`)
                .send({
                    operation: 'create',
                    payload: { title: 'Test' },
                })
                .expect(400);
        });

        it('should return 400 when operation is invalid', async () => {
            await request(app.getHttpServer())
                .post('/workflows')
                .set('Authorization', `Bearer ${creatorToken}`)
                .send({
                    entityType: 'content',
                    operation: 'invalid',
                    payload: { title: 'Test' },
                })
                .expect(400);
        });

        it('should return 400 when payload is missing', async () => {
            await request(app.getHttpServer())
                .post('/workflows')
                .set('Authorization', `Bearer ${creatorToken}`)
                .send({
                    entityType: 'content',
                    operation: 'create',
                })
                .expect(400);
        });

        it('should return 401 without auth token', async () => {
            await request(app.getHttpServer())
                .post('/workflows')
                .send({
                    entityType: 'content',
                    operation: 'create',
                    payload: { title: 'Test' },
                })
                .expect(401);
        });
    });

    // =========================================
    // GET /workflows - List Workflows
    // =========================================

    describe('GET /workflows', () => {
        beforeAll(async () => {
            // Create some workflows for testing
            for (let i = 0; i < 3; i++) {
                await request(app.getHttpServer())
                    .post('/workflows')
                    .set('Authorization', `Bearer ${creatorToken}`)
                    .send({
                        entityType: 'content',
                        operation: 'create',
                        payload: { title: `Workflow ${i}` },
                    });
            }
        });

        it('should return 200 with paginated list of workflows', async () => {
            const response = await request(app.getHttpServer())
                .get('/workflows')
                .set('Authorization', `Bearer ${creatorToken}`)
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
        });

        it('should filter by status', async () => {
            const response = await request(app.getHttpServer())
                .get('/workflows?status=draft')
                .set('Authorization', `Bearer ${creatorToken}`)
                .expect(200);

            response.body.data.forEach((w: any) => {
                expect(w.currentStatus).toBe('draft');
            });
        });

        it('should filter by mine=true', async () => {
            const response = await request(app.getHttpServer())
                .get('/workflows?mine=true')
                .set('Authorization', `Bearer ${creatorToken}`)
                .expect(200);

            response.body.data.forEach((w: any) => {
                expect(w.createdBy === creatorId || w.assignedTo === creatorId).toBe(true);
            });
        });

        it('should support pagination', async () => {
            const response = await request(app.getHttpServer())
                .get('/workflows?page=1&limit=2')
                .set('Authorization', `Bearer ${creatorToken}`)
                .expect(200);

            expect(response.body.data.length).toBeLessThanOrEqual(2);
            expect(response.body.meta.limit).toBe(2);
        });

        it('should return 401 without auth token', async () => {
            await request(app.getHttpServer()).get('/workflows').expect(401);
        });
    });

    // =========================================
    // GET /workflows/:id - Get Workflow
    // =========================================

    describe('GET /workflows/:id', () => {
        let testWorkflowId: string;

        beforeAll(async () => {
            const response = await request(app.getHttpServer())
                .post('/workflows')
                .set('Authorization', `Bearer ${creatorToken}`)
                .send({
                    entityType: 'content',
                    operation: 'create',
                    payload: { title: 'Get By ID Workflow' },
                });
            testWorkflowId = response.body.id;
        });

        it('should return 200 with workflow details and approvals', async () => {
            const response = await request(app.getHttpServer())
                .get(`/workflows/${testWorkflowId}`)
                .set('Authorization', `Bearer ${creatorToken}`)
                .expect(200);

            expect(response.body).toMatchObject({
                id: testWorkflowId,
                entityType: 'content',
                payload: { title: 'Get By ID Workflow' },
                approvals: expect.any(Array),
                createdByUser: expect.objectContaining({ id: creatorId }),
            });
        });

        it('should return 404 for non-existent workflow', async () => {
            const nonExistentId = '00000000-0000-0000-0000-000000000000';
            await request(app.getHttpServer())
                .get(`/workflows/${nonExistentId}`)
                .set('Authorization', `Bearer ${creatorToken}`)
                .expect(404);
        });

        it('should return 400 for invalid UUID format', async () => {
            await request(app.getHttpServer())
                .get('/workflows/invalid-uuid')
                .set('Authorization', `Bearer ${creatorToken}`)
                .expect(400);
        });
    });

    // =========================================
    // Workflow State Machine Flow
    // =========================================

    describe('Workflow State Machine', () => {
        let workflowId: string;

        beforeEach(async () => {
            // Create a fresh workflow for each test
            const response = await request(app.getHttpServer())
                .post('/workflows')
                .set('Authorization', `Bearer ${creatorToken}`)
                .send({
                    entityType: 'content',
                    operation: 'create',
                    payload: { title: 'State Machine Test' },
                });
            workflowId = response.body.id;
        });

        // =========================================
        // POST /workflows/:id/submit
        // =========================================

        describe('POST /workflows/:id/submit', () => {
            it('should transition draft to pending_review', async () => {
                const response = await request(app.getHttpServer())
                    .post(`/workflows/${workflowId}/submit`)
                    .set('Authorization', `Bearer ${creatorToken}`)
                    .expect(200);

                expect(response.body.currentStatus).toBe('pending_review');
                expect(response.body.submittedAt).toBeTruthy();

                // Database validation
                await expect({ entity: Workflow, id: workflowId }).toMatchInDb(em, {
                    currentStatus: WorkflowStatus.PENDING_REVIEW,
                });
            });

            it('should return 400 when already submitted', async () => {
                await request(app.getHttpServer())
                    .post(`/workflows/${workflowId}/submit`)
                    .set('Authorization', `Bearer ${creatorToken}`);

                await request(app.getHttpServer())
                    .post(`/workflows/${workflowId}/submit`)
                    .set('Authorization', `Bearer ${creatorToken}`)
                    .expect(400);
            });

            it('should return 403 when not the creator', async () => {
                await request(app.getHttpServer())
                    .post(`/workflows/${workflowId}/submit`)
                    .set('Authorization', `Bearer ${reviewerToken}`)
                    .expect(403);
            });
        });

        // =========================================
        // POST /workflows/:id/claim
        // =========================================

        describe('POST /workflows/:id/claim', () => {
            beforeEach(async () => {
                // Submit the workflow first
                await request(app.getHttpServer())
                    .post(`/workflows/${workflowId}/submit`)
                    .set('Authorization', `Bearer ${creatorToken}`);
            });

            it('should transition pending_review to in_review', async () => {
                const response = await request(app.getHttpServer())
                    .post(`/workflows/${workflowId}/claim`)
                    .set('Authorization', `Bearer ${reviewerToken}`)
                    .expect(200);

                expect(response.body.currentStatus).toBe('in_review');
                expect(response.body.assignedTo).toBe(reviewerId);
                expect(response.body.startedAt).toBeTruthy();

                // Database validation
                await expect({ entity: Workflow, id: workflowId }).toMatchInDb(em, {
                    currentStatus: WorkflowStatus.IN_REVIEW,
                });
            });

            it('should return 400 when not pending_review', async () => {
                // First claim succeeds
                await request(app.getHttpServer())
                    .post(`/workflows/${workflowId}/claim`)
                    .set('Authorization', `Bearer ${reviewerToken}`);

                // Second claim fails
                await request(app.getHttpServer())
                    .post(`/workflows/${workflowId}/claim`)
                    .set('Authorization', `Bearer ${creatorToken}`)
                    .expect(400);
            });
        });

        // =========================================
        // POST /workflows/:id/approve
        // =========================================

        describe('POST /workflows/:id/approve', () => {
            beforeEach(async () => {
                await request(app.getHttpServer())
                    .post(`/workflows/${workflowId}/submit`)
                    .set('Authorization', `Bearer ${creatorToken}`);
                await request(app.getHttpServer())
                    .post(`/workflows/${workflowId}/claim`)
                    .set('Authorization', `Bearer ${reviewerToken}`);
            });

            it('should transition in_review to approved', async () => {
                const response = await request(app.getHttpServer())
                    .post(`/workflows/${workflowId}/approve`)
                    .set('Authorization', `Bearer ${reviewerToken}`)
                    .send({ comment: 'Looks good!' })
                    .expect(200);

                expect(response.body.workflow.currentStatus).toBe('approved');
                expect(response.body.workflow.completedAt).toBeTruthy();
                expect(response.body.message).toBe('Workflow approved successfully');

                // Verify approval record was created
                await expect({
                    entity: Approval,
                    where: { workflow: { id: workflowId }, action: ApprovalAction.APPROVE },
                }).toExistInDb(em);
            });

            it('should return 403 when not the assigned reviewer', async () => {
                await request(app.getHttpServer())
                    .post(`/workflows/${workflowId}/approve`)
                    .set('Authorization', `Bearer ${creatorToken}`)
                    .expect(403);
            });

            it('should return 400 when not in_review', async () => {
                // Approve first
                await request(app.getHttpServer())
                    .post(`/workflows/${workflowId}/approve`)
                    .set('Authorization', `Bearer ${reviewerToken}`);

                // Try to approve again
                await request(app.getHttpServer())
                    .post(`/workflows/${workflowId}/approve`)
                    .set('Authorization', `Bearer ${reviewerToken}`)
                    .expect(400);
            });
        });

        // =========================================
        // POST /workflows/:id/reject
        // =========================================

        describe('POST /workflows/:id/reject', () => {
            beforeEach(async () => {
                await request(app.getHttpServer())
                    .post(`/workflows/${workflowId}/submit`)
                    .set('Authorization', `Bearer ${creatorToken}`);
                await request(app.getHttpServer())
                    .post(`/workflows/${workflowId}/claim`)
                    .set('Authorization', `Bearer ${reviewerToken}`);
            });

            it('should transition in_review to rejected', async () => {
                const response = await request(app.getHttpServer())
                    .post(`/workflows/${workflowId}/reject`)
                    .set('Authorization', `Bearer ${reviewerToken}`)
                    .send({ comment: 'Does not meet standards' })
                    .expect(200);

                expect(response.body.currentStatus).toBe('rejected');
                expect(response.body.completedAt).toBeTruthy();

                // Verify approval record was created
                await expect({
                    entity: Approval,
                    where: { workflow: { id: workflowId }, action: ApprovalAction.REJECT },
                }).toExistInDb(em);
            });

            it('should return 400 when comment is missing', async () => {
                await request(app.getHttpServer())
                    .post(`/workflows/${workflowId}/reject`)
                    .set('Authorization', `Bearer ${reviewerToken}`)
                    .send({})
                    .expect(400);
            });

            it('should return 403 when not the assigned reviewer', async () => {
                await request(app.getHttpServer())
                    .post(`/workflows/${workflowId}/reject`)
                    .set('Authorization', `Bearer ${creatorToken}`)
                    .send({ comment: 'Rejected' })
                    .expect(403);
            });
        });

        // =========================================
        // POST /workflows/:id/request-changes
        // =========================================

        describe('POST /workflows/:id/request-changes', () => {
            beforeEach(async () => {
                await request(app.getHttpServer())
                    .post(`/workflows/${workflowId}/submit`)
                    .set('Authorization', `Bearer ${creatorToken}`);
                await request(app.getHttpServer())
                    .post(`/workflows/${workflowId}/claim`)
                    .set('Authorization', `Bearer ${reviewerToken}`);
            });

            it('should transition in_review to changes_requested', async () => {
                const response = await request(app.getHttpServer())
                    .post(`/workflows/${workflowId}/request-changes`)
                    .set('Authorization', `Bearer ${reviewerToken}`)
                    .send({ comment: 'Please add more details' })
                    .expect(200);

                expect(response.body.currentStatus).toBe('changes_requested');
                expect(response.body.assignedTo).toBeNull(); // Assignment released

                // Verify approval record was created
                await expect({
                    entity: Approval,
                    where: { workflow: { id: workflowId }, action: ApprovalAction.REQUEST_CHANGES },
                }).toExistInDb(em);
            });

            it('should return 400 when comment is missing', async () => {
                await request(app.getHttpServer())
                    .post(`/workflows/${workflowId}/request-changes`)
                    .set('Authorization', `Bearer ${reviewerToken}`)
                    .send({})
                    .expect(400);
            });
        });

        // =========================================
        // POST /workflows/:id/comment
        // =========================================

        describe('POST /workflows/:id/comment', () => {
            it('should add comment without changing status', async () => {
                const response = await request(app.getHttpServer())
                    .post(`/workflows/${workflowId}/comment`)
                    .set('Authorization', `Bearer ${creatorToken}`)
                    .send({ comment: 'Just a note' })
                    .expect(201);

                expect(response.body).toMatchObject({
                    id: expect.any(String),
                    workflowId,
                    action: 'comment',
                    comment: 'Just a note',
                });

                // Verify workflow status unchanged
                const workflow = await request(app.getHttpServer())
                    .get(`/workflows/${workflowId}`)
                    .set('Authorization', `Bearer ${creatorToken}`);
                expect(workflow.body.currentStatus).toBe('draft');
            });

            it('should return 400 when comment is empty', async () => {
                await request(app.getHttpServer())
                    .post(`/workflows/${workflowId}/comment`)
                    .set('Authorization', `Bearer ${creatorToken}`)
                    .send({ comment: '' })
                    .expect(400);
            });
        });

        // =========================================
        // PATCH /workflows/:id/update-payload
        // =========================================

        describe('PATCH /workflows/:id/update-payload', () => {
            it('should update payload in draft status', async () => {
                const newPayload = { title: 'Updated Title', body: 'Updated Body' };
                const response = await request(app.getHttpServer())
                    .patch(`/workflows/${workflowId}/update-payload`)
                    .set('Authorization', `Bearer ${creatorToken}`)
                    .send({ payload: newPayload })
                    .expect(200);

                expect(response.body.payload).toEqual(newPayload);
            });

            it('should update payload in changes_requested status', async () => {
                // Submit and claim
                await request(app.getHttpServer())
                    .post(`/workflows/${workflowId}/submit`)
                    .set('Authorization', `Bearer ${creatorToken}`);
                await request(app.getHttpServer())
                    .post(`/workflows/${workflowId}/claim`)
                    .set('Authorization', `Bearer ${reviewerToken}`);
                // Request changes
                await request(app.getHttpServer())
                    .post(`/workflows/${workflowId}/request-changes`)
                    .set('Authorization', `Bearer ${reviewerToken}`)
                    .send({ comment: 'Fix it' });

                // Update payload
                const response = await request(app.getHttpServer())
                    .patch(`/workflows/${workflowId}/update-payload`)
                    .set('Authorization', `Bearer ${creatorToken}`)
                    .send({ payload: { title: 'Fixed' } })
                    .expect(200);

                expect(response.body.payload.title).toBe('Fixed');
            });

            it('should return 403 when not the creator', async () => {
                await request(app.getHttpServer())
                    .patch(`/workflows/${workflowId}/update-payload`)
                    .set('Authorization', `Bearer ${reviewerToken}`)
                    .send({ payload: { title: 'Hack' } })
                    .expect(403);
            });

            it('should return 400 when in_review', async () => {
                await request(app.getHttpServer())
                    .post(`/workflows/${workflowId}/submit`)
                    .set('Authorization', `Bearer ${creatorToken}`);
                await request(app.getHttpServer())
                    .post(`/workflows/${workflowId}/claim`)
                    .set('Authorization', `Bearer ${reviewerToken}`);

                await request(app.getHttpServer())
                    .patch(`/workflows/${workflowId}/update-payload`)
                    .set('Authorization', `Bearer ${creatorToken}`)
                    .send({ payload: { title: 'Updated' } })
                    .expect(400);
            });
        });

        // =========================================
        // DELETE /workflows/:id - Cancel
        // =========================================

        describe('DELETE /workflows/:id', () => {
            it('should cancel workflow in draft status', async () => {
                await request(app.getHttpServer())
                    .delete(`/workflows/${workflowId}`)
                    .set('Authorization', `Bearer ${creatorToken}`)
                    .expect(204);

                // Verify workflow deleted
                await expect({ entity: Workflow, id: workflowId }).toNotExistInDb(em);
            });

            it('should cancel workflow in pending_review status', async () => {
                await request(app.getHttpServer())
                    .post(`/workflows/${workflowId}/submit`)
                    .set('Authorization', `Bearer ${creatorToken}`);

                await request(app.getHttpServer())
                    .delete(`/workflows/${workflowId}`)
                    .set('Authorization', `Bearer ${creatorToken}`)
                    .expect(204);
            });

            it('should return 403 when not the creator', async () => {
                await request(app.getHttpServer())
                    .delete(`/workflows/${workflowId}`)
                    .set('Authorization', `Bearer ${reviewerToken}`)
                    .expect(403);
            });

            it('should return 400 when in_review', async () => {
                await request(app.getHttpServer())
                    .post(`/workflows/${workflowId}/submit`)
                    .set('Authorization', `Bearer ${creatorToken}`);
                await request(app.getHttpServer())
                    .post(`/workflows/${workflowId}/claim`)
                    .set('Authorization', `Bearer ${reviewerToken}`);

                await request(app.getHttpServer())
                    .delete(`/workflows/${workflowId}`)
                    .set('Authorization', `Bearer ${creatorToken}`)
                    .expect(400);
            });
        });
    });

    // =========================================
    // Changes Requested -> Resubmit Flow
    // =========================================

    describe('Resubmit Flow', () => {
        it('should allow resubmit after changes_requested', async () => {
            // Create
            const createResponse = await request(app.getHttpServer())
                .post('/workflows')
                .set('Authorization', `Bearer ${creatorToken}`)
                .send({
                    entityType: 'content',
                    operation: 'create',
                    payload: { title: 'Original' },
                });
            const workflowId = createResponse.body.id;

            // Submit
            await request(app.getHttpServer())
                .post(`/workflows/${workflowId}/submit`)
                .set('Authorization', `Bearer ${creatorToken}`);

            // Claim
            await request(app.getHttpServer())
                .post(`/workflows/${workflowId}/claim`)
                .set('Authorization', `Bearer ${reviewerToken}`);

            // Request changes
            await request(app.getHttpServer())
                .post(`/workflows/${workflowId}/request-changes`)
                .set('Authorization', `Bearer ${reviewerToken}`)
                .send({ comment: 'Fix it' });

            // Update payload
            await request(app.getHttpServer())
                .patch(`/workflows/${workflowId}/update-payload`)
                .set('Authorization', `Bearer ${creatorToken}`)
                .send({ payload: { title: 'Fixed' } });

            // Resubmit
            const resubmitResponse = await request(app.getHttpServer())
                .post(`/workflows/${workflowId}/submit`)
                .set('Authorization', `Bearer ${creatorToken}`)
                .expect(200);

            expect(resubmitResponse.body.currentStatus).toBe('pending_review');
        });
    });
});
