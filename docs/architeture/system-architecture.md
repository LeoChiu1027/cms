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

## Content Approval Workflow

```mermaid
stateDiagram-v2
    [*] --> Draft: Create

    Draft --> PendingReview: Submit for Review
    Draft --> Draft: Save Draft

    PendingReview --> InReview: Reviewer Picks Up
    PendingReview --> Draft: Author Recalls

    InReview --> Approved: Approve
    InReview --> Rejected: Reject
    InReview --> ChangesRequested: Request Changes

    ChangesRequested --> Draft: Author Revises

    Rejected --> Draft: Author Revises
    Rejected --> Archived: Discard

    Approved --> Scheduled: Schedule Publish
    Approved --> Published: Publish Now

    Scheduled --> Published: Publish Time Reached

    Published --> Draft: Unpublish & Edit
    Published --> Archived: Archive

    Archived --> Draft: Restore
    Archived --> [*]: Delete Permanently
```

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

## Request Flow with RBAC & Approval

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
    CS->>DB: Insert Content (status: draft)
    CS->>WF: Initialize Workflow
    WF->>DB: Create Workflow Instance
    DB-->>CS: Content Created
    CS-->>GW: Response
    GW-->>U: 201 Created

    Note over U,DB: Later: Submit for Approval

    U->>GW: POST /api/content/{id}/submit
    GW->>Auth: Validate Token
    GW->>RBAC: Check Permission
    GW->>WF: Transition State
    WF->>DB: Update Status to pending_review
    WF->>WF: Notify Reviewers
    WF-->>GW: State Updated
    GW-->>U: 200 OK
```

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
