# Workflow Module Sequence Diagrams

## State Machine Overview

```mermaid
stateDiagram-v2
    [*] --> draft: Create Workflow
    draft --> pending_review: Submit
    draft --> [*]: Cancel
    
    pending_review --> in_review: Claim
    pending_review --> [*]: Cancel
    
    in_review --> approved: Approve
    in_review --> rejected: Reject
    in_review --> changes_requested: Request Changes
    
    changes_requested --> pending_review: Resubmit
    
    approved --> [*]: Complete
    rejected --> [*]: Complete
```

---

## 1. Create and Submit Workflow

```mermaid
sequenceDiagram
    participant Client
    participant Controller as WorkflowController
    participant Service as WorkflowService
    participant DB as Database

    Client->>Controller: POST /workflows
    Note right of Client: { entityType, operation, payload }

    Controller->>Controller: Validate CreateWorkflowDto
    Controller->>Service: create(dto, userId)

    Service->>DB: INSERT workflows (status: draft)
    Service-->>Controller: Workflow entity
    Controller-->>Client: 201 Created

    Client->>Controller: POST /workflows/:id/submit
    Controller->>Service: submit(workflowId, userId)

    Service->>DB: SELECT workflow WHERE id
    alt Workflow not found
        Service-->>Controller: NotFoundException
        Controller-->>Client: 404 Not Found
    end

    alt Not draft status
        Service-->>Controller: BadRequestException
        Controller-->>Client: 400 Bad Request
    end

    alt Not the creator
        Service-->>Controller: ForbiddenException
        Controller-->>Client: 403 Forbidden
    end

    Service->>DB: UPDATE workflow SET status = 'pending_review', submittedAt = NOW()
    Service-->>Controller: Updated Workflow
    Controller-->>Client: 200 OK
```

---

## 2. Claim and Review Workflow

```mermaid
sequenceDiagram
    participant Reviewer
    participant Controller as WorkflowController
    participant Service as WorkflowService
    participant DB as Database

    Reviewer->>Controller: POST /workflows/:id/claim
    Controller->>Service: claim(workflowId, reviewerId)

    Service->>DB: SELECT workflow WHERE id
    alt Not pending_review
        Service-->>Controller: BadRequestException
        Controller-->>Reviewer: 400 "Workflow is not pending review"
    end

    alt Already assigned
        Service-->>Controller: BadRequestException
        Controller-->>Reviewer: 400 "Workflow already assigned"
    end

    Service->>DB: UPDATE workflow SET status = 'in_review', assignedTo, startedAt
    Service-->>Controller: Updated Workflow
    Controller-->>Reviewer: 200 OK
```

---

## 3. Approve Workflow (Content Create)

```mermaid
sequenceDiagram
    participant Reviewer
    participant Controller as WorkflowController
    participant WService as WorkflowService
    participant CService as ContentService
    participant DB as Database

    Reviewer->>Controller: POST /workflows/:id/approve
    Note right of Reviewer: { comment?: "Looks good" }

    Controller->>WService: approve(workflowId, dto, reviewerId)

    WService->>DB: SELECT workflow WHERE id
    alt Not in_review
        WService-->>Controller: BadRequestException
        Controller-->>Reviewer: 400 "Workflow is not in review"
    end

    WService->>DB: BEGIN TRANSACTION

    rect rgb(240, 248, 255)
        Note over WService,CService: Apply payload based on operation
        alt operation = CREATE
            WService->>CService: createFromPayload(payload)
            CService->>DB: INSERT content + type-specific data
            CService-->>WService: Created entity
        else operation = UPDATE
            WService->>CService: updateFromPayload(entityId, payload)
            CService->>DB: UPDATE entity
            CService-->>WService: Updated entity
        else operation = DELETE
            WService->>CService: deleteById(entityId)
            CService->>DB: UPDATE SET deletedAt
        end
    end

    WService->>DB: INSERT approvals (action: approve)
    WService->>DB: UPDATE workflow SET status = 'approved', completedAt = NOW()
    WService->>DB: COMMIT

    WService-->>Controller: { workflow, entity }
    Controller-->>Reviewer: 200 OK
```

---

## 4. Reject Workflow

```mermaid
sequenceDiagram
    participant Reviewer
    participant Controller as WorkflowController
    participant Service as WorkflowService
    participant DB as Database

    Reviewer->>Controller: POST /workflows/:id/reject
    Note right of Reviewer: { comment: "Does not meet standards" }

    Controller->>Controller: Validate comment required
    Controller->>Service: reject(workflowId, dto, reviewerId)

    Service->>DB: SELECT workflow WHERE id
    alt Not in_review
        Service-->>Controller: BadRequestException
        Controller-->>Reviewer: 400 Bad Request
    end

    Service->>DB: BEGIN TRANSACTION
    Service->>DB: INSERT approvals (action: reject, comment)
    Service->>DB: UPDATE workflow SET status = 'rejected', completedAt = NOW()
    Service->>DB: COMMIT

    Service-->>Controller: Updated Workflow
    Controller-->>Reviewer: 200 OK
```

---

## 5. Request Changes Flow

```mermaid
sequenceDiagram
    participant Reviewer
    participant Creator
    participant Controller as WorkflowController
    participant Service as WorkflowService
    participant DB as Database

    Reviewer->>Controller: POST /workflows/:id/request-changes
    Note right of Reviewer: { comment: "Please add description" }

    Controller->>Service: requestChanges(workflowId, dto, reviewerId)
    Service->>DB: INSERT approvals (action: request_changes)
    Service->>DB: UPDATE workflow SET status = 'changes_requested'
    Service-->>Controller: Updated Workflow
    Controller-->>Reviewer: 200 OK

    Note over Creator: Creator sees changes_requested status

    Creator->>Controller: PATCH /workflows/:id/update-payload
    Note right of Creator: { description: "Added description" }

    Controller->>Service: updatePayload(workflowId, payload, userId)

    alt Not creator
        Service-->>Controller: ForbiddenException
        Controller-->>Creator: 403 Forbidden
    end

    alt Not editable status
        Service-->>Controller: BadRequestException
        Controller-->>Creator: 400 "Workflow not in editable status"
    end

    Service->>DB: UPDATE workflow SET payload = newPayload
    Service-->>Controller: Updated Workflow
    Controller-->>Creator: 200 OK

    Creator->>Controller: POST /workflows/:id/submit
    Note over Creator: Resubmit after changes
    Controller->>Service: submit(workflowId, userId)
    Service->>DB: UPDATE workflow SET status = 'pending_review'
    Service-->>Controller: Updated Workflow
    Controller-->>Creator: 200 OK
```

---

## 6. Cancel Workflow

```mermaid
sequenceDiagram
    participant Creator
    participant Controller as WorkflowController
    participant Service as WorkflowService
    participant DB as Database

    Creator->>Controller: DELETE /workflows/:id

    Controller->>Service: cancel(workflowId, userId)

    Service->>DB: SELECT workflow WHERE id

    alt Not creator
        Service-->>Controller: ForbiddenException
        Controller-->>Creator: 403 "Only creator can cancel"
    end

    alt Status not cancellable
        Service-->>Controller: BadRequestException
        Controller-->>Creator: 400 "Cannot cancel workflow in review"
    end

    Service->>DB: DELETE workflow
    Service-->>Controller: void
    Controller-->>Creator: 204 No Content
```

---

## Endpoint Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /workflows | Create workflow (draft) |
| GET | /workflows | List workflows (filtered) |
| GET | /workflows/:id | Get workflow with approvals |
| DELETE | /workflows/:id | Cancel workflow |
| POST | /workflows/:id/submit | Submit for review |
| POST | /workflows/:id/claim | Claim for review |
| POST | /workflows/:id/approve | Approve and apply changes |
| POST | /workflows/:id/reject | Reject with comment |
| POST | /workflows/:id/request-changes | Request changes |
| POST | /workflows/:id/comment | Add comment |
| PATCH | /workflows/:id/update-payload | Update payload |
| GET | /workflows/config | List configs |
| GET | /workflows/config/:type | Get config |
| PATCH | /workflows/config/:type | Update config |
