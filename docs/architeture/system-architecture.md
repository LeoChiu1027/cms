# CMS System Architecture

## High-Level System Architecture

```mermaid
flowchart TB
    subgraph Client["Client Layer"]
        WebApp["Web Application<br/>(React/Next.js)"]
        AdminPanel["Admin Panel"]
    end

    subgraph NestJS["NestJS API Server"]
        subgraph Core["Core Module"]
            Guards["Auth Guards"]
            Filters["Exception Filters"]
            Interceptors["Logging/Transform<br/>Interceptors"]
        end

        subgraph Modules["Feature Modules"]
            AuthModule["Auth Module"]
            RBACModule["RBAC Module"]
            ContentModule["Content Module"]
            WorkflowModule["Workflow Module"]
            MediaModule["Media Module"]
        end

        subgraph Shared["Shared Module"]
            AuditService["Audit Service"]
            CacheService["Cache Service"]
        end
    end

    subgraph Data["Data Layer"]
        MikroORM["MikroORM"]
        PostgreSQL[(PostgreSQL)]
        Redis[(Redis<br/>Cache/Session)]
        S3["Object Storage<br/>(S3/MinIO)"]
    end

    WebApp --> NestJS
    AdminPanel --> NestJS

    Guards --> AuthModule
    AuthModule --> MikroORM
    AuthModule --> Redis
    RBACModule --> MikroORM
    RBACModule --> Redis
    ContentModule --> MikroORM
    ContentModule --> CacheService
    WorkflowModule --> MikroORM

    MediaModule --> S3
    AuditService --> MikroORM
    CacheService --> Redis
    MikroORM --> PostgreSQL
```

## NestJS Module Structure

```mermaid
flowchart TB
    subgraph AppModule["AppModule"]
        subgraph CoreModule["CoreModule (Global)"]
            direction TB
            AuthGuard["AuthGuard"]
            RolesGuard["RolesGuard"]
            PermissionsGuard["PermissionsGuard"]
            HttpExceptionFilter["HttpExceptionFilter"]
            LoggingInterceptor["LoggingInterceptor"]
            TransformInterceptor["TransformInterceptor"]
        end

        subgraph SharedModule["SharedModule (Global)"]
            direction TB
            AuditSvc["AuditService"]
            CacheSvc["CacheService"]
            PaginationSvc["PaginationService"]
        end

        subgraph AuthMod["AuthModule"]
            AuthController["AuthController"]
            AuthService["AuthService"]
            JwtStrategy["JwtStrategy"]
            UserEntity["User Entity"]
            SessionEntity["Session Entity"]
        end

        subgraph RBACMod["RBACModule"]
            RoleController["RoleController"]
            PermissionController["PermissionController"]
            RBACService["RBACService"]
            RoleEntity["Role Entity"]
            PermissionEntity["Permission Entity"]
        end

        subgraph ContentMod["ContentModule"]
            ContentController["ContentController"]
            ProductController["ProductController"]
            BlogController["BlogController"]
            ContentSvc["ContentService"]
            ProductSvc["ProductService"]
            BlogSvc["BlogService"]
            ContentEntity["Content Entity"]
            ProductEntity["Product Entity"]
            BlogEntity["Blog Entity"]
        end

        subgraph WorkflowMod["WorkflowModule"]
            WorkflowController["WorkflowController"]
            WorkflowSvc["WorkflowService"]
            ApprovalSvc["ApprovalService"]
            WorkflowEntity["Workflow Entity"]
            ApprovalEntity["Approval Entity"]
            WorkflowConfigEntity["WorkflowConfig Entity"]
        end

        subgraph MediaMod["MediaModule"]
            MediaController["MediaController"]
            MediaSvc["MediaService"]
            StorageSvc["StorageService"]
            MediaEntity["Media Entity"]
        end
    end

    CoreModule --> SharedModule
    AuthMod --> CoreModule
    RBACMod --> CoreModule
    ContentMod --> CoreModule
    ContentMod --> WorkflowMod
    WorkflowMod --> CoreModule
    MediaMod --> CoreModule
```

## RBAC Model

```mermaid
flowchart LR
    subgraph Users
        User["User"]
    end

    subgraph Roles
        SuperAdmin["Super Admin"]
        Admin["Admin"]
        Editor["Editor"]
        Author["Author"]
        Reviewer["Reviewer"]
        Viewer["Viewer"]
    end

    subgraph Permissions
        Create["Create"]
        Read["Read"]
        Update["Update"]
        Delete["Delete"]
        Publish["Publish"]
        Approve["Approve"]
        ManageUsers["Manage Users"]
        ManageRoles["Manage Roles"]
    end

    User --> SuperAdmin
    User --> Admin
    User --> Editor
    User --> Author
    User --> Reviewer
    User --> Viewer

    SuperAdmin --> Create & Read & Update & Delete & Publish & Approve & ManageUsers & ManageRoles
    Admin --> Create & Read & Update & Delete & Publish & Approve & ManageUsers
    Editor --> Create & Read & Update & Publish
    Author --> Create & Read & Update
    Reviewer --> Read & Approve
    Viewer --> Read
```

## Polymorphic Workflow System

The workflow system supports approval processes for multiple entity types using a polymorphic design pattern. Currently active for content; other entity types are designed for future use.

### Supported Entity Types

| Entity Type | Description | Status |
|-------------|-------------|--------|
| `content` | Blog posts, products, pages | **Active** |
| `role` | RBAC roles | Future |
| `permission` | RBAC permissions | Future |
| `user_role` | User-role assignments | Future |

### Workflow Architecture

```mermaid
flowchart TB
    subgraph Entities["Entity Types"]
        Content["Content<br/>(blogs, products)"]
        Role["Role"]
        Permission["Permission"]
        UserRole["User-Role<br/>Assignment"]
    end

    subgraph WorkflowEngine["Workflow Engine"]
        WS["WorkflowService"]
        WC["WorkflowConfig"]

        subgraph Actions["Actions"]
            Submit["Submit"]
            Claim["Claim"]
            Approve["Approve"]
            Reject["Reject"]
            RequestChanges["Request Changes"]
        end
    end

    subgraph Storage["Workflow Storage"]
        Workflows["workflows table<br/>(entity_type, entity_id,<br/>operation, payload)"]
        Approvals["approvals table<br/>(action, comment)"]
        Configs["workflow_configs table<br/>(per entity type)"]
    end

    Content --> WS
    Role --> WS
    Permission --> WS
    UserRole --> WS

    WS --> WC
    WC --> Configs
    WS --> Workflows
    Actions --> Approvals
```

### Workflow Entity Schema

```mermaid
erDiagram
    WORKFLOW {
        uuid id PK
        string entity_type "content|role|permission|user_role"
        uuid entity_id "null for create ops"
        string operation "create|update|delete"
        jsonb payload "proposed changes"
        string current_status
        string previous_status
        uuid assigned_to FK
        uuid created_by FK
        timestamp submitted_at
        timestamp completed_at
    }

    APPROVAL {
        uuid id PK
        uuid workflow_id FK
        uuid reviewer_id FK
        string action "approve|reject|request_changes|comment"
        text comment
        string from_status
        string to_status
        timestamp created_at
    }

    WORKFLOW_CONFIG {
        uuid id PK
        string entity_type UK
        boolean requires_approval
        jsonb auto_approve_for_roles
        int min_approvers
        boolean notify_on_submit
        boolean notify_on_complete
    }

    WORKFLOW ||--o{ APPROVAL : "has"
    WORKFLOW_CONFIG ||--o{ WORKFLOW : "configures"
```

## Workflow State Machine

```mermaid
stateDiagram-v2
    [*] --> Draft: Create

    Draft --> PendingReview: Submit for Review
    Draft --> Draft: Save Draft

    PendingReview --> InReview: Reviewer Claims
    PendingReview --> Approved: Direct Approve
    PendingReview --> Draft: Author Recalls

    InReview --> Approved: Approve
    InReview --> Rejected: Reject
    InReview --> ChangesRequested: Request Changes

    ChangesRequested --> PendingReview: Resubmit
    ChangesRequested --> Draft: Save Draft

    Rejected --> Draft: Author Revises
    Rejected --> [*]: Discard

    Approved --> [*]: Apply Changes

    note right of Approved
        On approval:
        - CREATE: Insert new entity
        - UPDATE: Apply changes
        - DELETE: Remove entity
    end note
```

### Content-Specific Extended States

For content entities, additional states are available after approval:

```mermaid
stateDiagram-v2
    Approved --> Scheduled: Schedule Publish
    Approved --> Published: Publish Now

    Scheduled --> Published: Publish Time Reached

    Published --> Draft: Unpublish & Edit
    Published --> Archived: Archive

    Archived --> Draft: Restore
    Archived --> [*]: Delete Permanently
```

## Request Flow: Create Role (RBAC)

```mermaid
sequenceDiagram
    participant U as User
    participant RC as RolesController
    participant PG as PermissionsGuard
    participant RS as RolesService
    participant DB as PostgreSQL
    participant Cache as Redis

    U->>RC: POST /roles {name, slug, description}
    RC->>PG: Check permission (roles:create)
    PG->>Cache: Get user permissions
    Cache-->>PG: Permissions
    PG-->>RC: Authorized

    RC->>RC: Validate DTO
    RC->>RS: createRole(dto)
    RS->>DB: Check if name/slug exists

    alt Already exists
        RS-->>RC: ConflictException
        RC-->>U: 409 Conflict
    end

    RS->>DB: INSERT INTO roles
    RS-->>RC: Role
    RC-->>U: 201 Created {role}
```

> **Future Enhancement**: The workflow system is designed to support RBAC approval flows. See `docs/schema/workflow.dbml` for the polymorphic workflow schema that can be enabled for roles, permissions, and user-role assignments.

## Request Flow: Content with RBAC & Approval

```mermaid
sequenceDiagram
    participant U as User
    participant GW as API Gateway
    participant Auth as Auth Service
    participant RBAC as RBAC Service
    participant CS as Content Service
    participant WF as Workflow Service
    participant DB as PostgreSQL
    participant Cache as Redis

    U->>GW: POST /api/content (Create Blog)
    GW->>Auth: Validate Token
    Auth->>Cache: Check Session
    Cache-->>Auth: Session Valid
    Auth-->>GW: User Authenticated

    GW->>RBAC: Check Permission (content:create)
    RBAC->>Cache: Get User Roles/Permissions
    Cache-->>RBAC: Cached Permissions
    RBAC-->>GW: Permission Granted

    GW->>CS: Create Content
    CS->>WF: checkApprovalRequired('content', userId)
    WF-->>CS: {requiresApproval: true/false}

    alt Approval Required
        CS->>WF: createWorkflow('content', 'create', payload)
        WF->>DB: Insert Workflow
        WF-->>CS: Workflow
        CS-->>GW: 202 Accepted {workflow}
    else Direct Creation
        CS->>DB: Insert Content (status: draft)
        CS-->>GW: 201 Created {content}
    end

    GW-->>U: Response
```

## Workflow Configuration

Each entity type can be configured independently:

```json
{
  "entityType": "role",
  "requiresApproval": true,
  "autoApproveForRoles": ["super-admin", "admin"],
  "minApprovers": 1,
  "notifyOnSubmit": true,
  "notifyOnComplete": true
}
```

### Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `requiresApproval` | boolean | Whether this entity type requires approval workflow |
| `autoApproveForRoles` | string[] | Role slugs that bypass the approval process |
| `minApprovers` | number | Minimum number of approvals required |
| `notifyOnSubmit` | boolean | Send notifications when workflow submitted |
| `notifyOnComplete` | boolean | Send notifications when workflow completed |

## Content Types & Polymorphic Structure

```mermaid
erDiagram
    CONTENT {
        uuid id PK
        string content_type
        string status
        uuid created_by FK
        timestamp created_at
        timestamp updated_at
    }

    PRODUCT {
        uuid id PK
        uuid content_id FK
        string name
        text description
        decimal price
        json attributes
    }

    BLOG {
        uuid id PK
        uuid content_id FK
        string title
        text body
        string slug
        json seo_meta
    }

    CONTENT_VERSION {
        uuid id PK
        uuid content_id FK
        int version_number
        json data_snapshot
        timestamp created_at
    }

    CONTENT ||--o| PRODUCT : "has"
    CONTENT ||--o| BLOG : "has"
    CONTENT ||--o{ CONTENT_VERSION : "versions"
```

## Module Dependencies

```mermaid
flowchart TD
    subgraph Core["Core (Global)"]
        CoreModule
    end

    subgraph Shared["Shared (Global)"]
        SharedModule
    end

    subgraph Features["Feature Modules"]
        AuthModule
        RBACModule
        WorkflowModule
        ContentModule
        MediaModule
    end

    CoreModule --> SharedModule

    AuthModule --> CoreModule

    RBACModule --> CoreModule

    WorkflowModule --> CoreModule

    ContentModule --> CoreModule
    ContentModule --> WorkflowModule

    MediaModule --> CoreModule

    style WorkflowModule fill:#f9f,stroke:#333
```

> **Note**: RBAC currently operates without workflow integration. The polymorphic workflow system is designed to support RBAC approval flows in the future (dashed line represents future integration).

## Deployment Architecture

```mermaid
flowchart TB
    subgraph CDN["CDN (CloudFlare/CloudFront)"]
        Static["Static Assets"]
    end

    subgraph LB["Load Balancer"]
        ALB["Application LB"]
    end

    subgraph Compute["Compute (K8s/ECS)"]
        API1["API Instance 1"]
        API2["API Instance 2"]
        API3["API Instance N"]
    end

    subgraph Database["Database Cluster"]
        Primary["PostgreSQL Primary"]
        Replica1["Read Replica 1"]
        Replica2["Read Replica 2"]
    end

    subgraph Cache["Cache Cluster"]
        Redis1["Redis Primary"]
        Redis2["Redis Replica"]
    end

    subgraph Storage["Object Storage"]
        S3["S3/MinIO"]
    end

    CDN --> LB
    LB --> API1 & API2 & API3
    API1 & API2 & API3 --> Primary
    API1 & API2 & API3 --> Replica1 & Replica2
    API1 & API2 & API3 --> Redis1
    API1 & API2 & API3 --> S3
    Redis1 --> Redis2
    Primary --> Replica1 & Replica2
```
