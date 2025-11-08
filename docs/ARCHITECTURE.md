# CMS Architecture Documentation

## System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Dashboard]
        API_CLIENT[API Clients]
    end

    subgraph "API Gateway Layer"
        NGINX[NGINX / API Gateway]
    end

    subgraph "NestJS Application"
        subgraph "Auth & Security"
            AUTH[Auth Module]
            RBAC[RBAC Guard]
            JWT[JWT Strategy]
        end

        subgraph "Core Modules"
            USER[Users Module]
            ROLE[Roles Module]
            PERM[Permissions Module]
        end

        subgraph "CMS Modules"
            CONTENT[Content Module]
            CATEGORY[Categories Module]
            MEDIA[Media Module]
            WORKFLOW[Workflow Module]
            APPROVAL[Approval Module]
            AUDIT[Audit Log Module]
        end

        subgraph "Notification"
            NOTIF[Notifications Module]
            EMAIL[Email Service]
        end
    end

    subgraph "Data Layer"
        DB[(PostgreSQL)]
        REDIS[(Redis Cache)]
        S3[Object Storage]
    end

    WEB --> NGINX
    API_CLIENT --> NGINX
    NGINX --> AUTH
    
    AUTH --> JWT
    AUTH --> RBAC
    RBAC --> PERM
    
    USER --> ROLE
    ROLE --> PERM
    
    CONTENT --> WORKFLOW
    CONTENT --> MEDIA
    CONTENT --> CATEGORY
    WORKFLOW --> APPROVAL
    APPROVAL --> NOTIF
    NOTIF --> EMAIL
    
    CONTENT --> AUDIT
    APPROVAL --> AUDIT
    USER --> AUDIT
    
    USER --> DB
    ROLE --> DB
    PERM --> DB
    CONTENT --> DB
    WORKFLOW --> DB
    APPROVAL --> DB
    AUDIT --> DB
    
    CONTENT --> REDIS
    USER --> REDIS
    
    MEDIA --> S3

    classDef authStyle fill:#ff9999
    classDef coreStyle fill:#99ccff
    classDef cmsStyle fill:#99ff99
    classDef dataStyle fill:#ffcc99
    
    class AUTH,RBAC,JWT authStyle
    class USER,ROLE,PERM coreStyle
    class CONTENT,WORKFLOW,APPROVAL,MEDIA,CATEGORY,AUDIT,NOTIF cmsStyle
    class DB,REDIS,S3 dataStyle
```

## Content Approval Workflow Sequence

```mermaid
sequenceDiagram
    participant Author
    participant API
    participant ContentService
    participant WorkflowService
    participant ApprovalService
    participant NotificationService
    participant Reviewer
    participant Publisher

    Author->>API: Create/Update Content (Draft)
    API->>ContentService: Validate & Save Draft
    ContentService->>WorkflowService: Check Workflow Rules
    WorkflowService-->>Author: Content Saved (Pending)

    Author->>API: Submit for Review
    API->>WorkflowService: Start Approval Flow
    WorkflowService->>ApprovalService: Create Approval Request
    ApprovalService->>NotificationService: Notify Reviewers
    NotificationService-->>Reviewer: Email/In-app Notification

    Reviewer->>API: Review Content
    API->>ApprovalService: Approve/Reject
    
    alt Approved
        ApprovalService->>WorkflowService: Move to Next Step
        WorkflowService->>NotificationService: Notify Publisher
        NotificationService-->>Publisher: Ready to Publish
        Publisher->>API: Publish Content
        API->>ContentService: Set Status = Published
        ContentService->>NotificationService: Notify Author
    else Rejected
        ApprovalService->>WorkflowService: Return to Author
        WorkflowService->>NotificationService: Notify Author
        NotificationService-->>Author: Revision Required
    end
```

## Multi-Step Approval Workflow

```mermaid
sequenceDiagram
    participant Author
    participant System
    participant ContentReviewer
    participant LegalReviewer
    participant Publisher
    participant DB

    Author->>System: Submit Content
    System->>DB: Create Approval Request
    System->>DB: Set Current Step = Content Review
    
    System->>ContentReviewer: Notify (Step 1: Content Review)
    ContentReviewer->>System: Approve
    System->>DB: Record Approval Action
    System->>DB: Move to Next Step (Legal Review)
    
    System->>LegalReviewer: Notify (Step 2: Legal Review)
    LegalReviewer->>System: Approve
    System->>DB: Record Approval Action
    System->>DB: Move to Next Step (Final Approval)
    
    System->>Publisher: Notify (Step 3: Final Approval)
    Publisher->>System: Publish
    System->>DB: Update Status = Published
    System->>Author: Notify (Content Published)
```

## RBAC Permission Check Flow

```mermaid
sequenceDiagram
    participant Client
    participant Controller
    participant RBACGuard
    participant PermissionService
    participant DB
    
    Client->>Controller: Request with JWT Token
    Controller->>RBACGuard: canActivate()
    RBACGuard->>PermissionService: checkPermission(user, resource, action)
    
    PermissionService->>DB: Get User Roles
    DB-->>PermissionService: roles[]
    
    PermissionService->>DB: Get Role Permissions
    DB-->>PermissionService: permissions[]
    
    PermissionService->>PermissionService: Check if permission exists
    
    alt Has Permission
        PermissionService-->>RBACGuard: true
        RBACGuard-->>Controller: Access Granted
        Controller-->>Client: Process Request
    else No Permission
        PermissionService-->>RBACGuard: false
        RBACGuard-->>Controller: Access Denied
        Controller-->>Client: 403 Forbidden
    end
```

## Module Dependencies

```mermaid
graph LR
    subgraph "Core Layer"
        AUTH[Auth Module]
        USER[Users Module]
        ROLE[Roles Module]
        PERM[Permissions Module]
    end
    
    subgraph "Business Layer"
        CONTENT[Content Module]
        WORKFLOW[Workflow Module]
        APPROVAL[Approval Module]
        MEDIA[Media Module]
    end
    
    subgraph "Support Layer"
        NOTIF[Notifications Module]
        AUDIT[Audit Module]
    end
    
    AUTH --> USER
    USER --> ROLE
    ROLE --> PERM
    
    CONTENT --> USER
    CONTENT --> MEDIA
    CONTENT --> WORKFLOW
    WORKFLOW --> APPROVAL
    APPROVAL --> USER
    APPROVAL --> NOTIF
    
    CONTENT --> AUDIT
    APPROVAL --> AUDIT
    USER --> AUDIT
    
    NOTIF --> USER
```

## Key Architectural Patterns

### 1. **Modular Architecture**
- Each domain has its own module (Content, Workflow, Approval, etc.)
- Modules are loosely coupled through dependency injection
- Shared functionality in Core modules (Auth, Users, Roles, Permissions)

### 2. **Layered Architecture**
- **Presentation Layer**: Controllers handle HTTP requests/responses
- **Business Logic Layer**: Services contain domain logic
- **Data Access Layer**: Repositories/ORMs interact with database
- **Cross-cutting Concerns**: Guards, Interceptors, Pipes

### 3. **RBAC Implementation**
- Permission-based access control at resource + action level
- Users → Roles → Permissions (many-to-many relationships)
- RBAC Guard intercepts requests and validates permissions
- Cached permission checks in Redis for performance

### 4. **Workflow Engine**
- Configurable multi-step approval workflows
- Each step can have multiple assignees (users or roles)
- Required approval count per step
- Auto-approval and skip step capabilities
- Timeout handling for SLA compliance

### 5. **Event-Driven Notifications**
- Approval events trigger notifications
- Support for in-app and email notifications
- Notification service decoupled from business logic

### 6. **Audit Trail**
- All mutations logged with JSON diffs
- IP address and user agent tracking
- Queryable audit log for compliance

## Technology Stack

### Backend
- **Framework**: NestJS (TypeScript)
- **Database**: PostgreSQL with TypeORM
- **Cache**: Redis
- **Storage**: S3-compatible object storage
- **Authentication**: JWT with Passport

### Infrastructure
- **API Gateway**: NGINX
- **Container**: Docker
- **Orchestration**: Kubernetes (optional)

## Security Considerations

1. **Authentication**: JWT-based with refresh tokens
2. **Authorization**: RBAC with fine-grained permissions
3. **Input Validation**: DTOs with class-validator
4. **Rate Limiting**: Per-user and per-endpoint limits
5. **Audit Logging**: All actions tracked
6. **Content Versioning**: Change history maintained
7. **Session Management**: Token rotation and expiration

## Performance Optimizations

1. **Caching**: Redis for permissions and content
2. **Indexing**: Strategic DB indexes on foreign keys and query fields
3. **Pagination**: Cursor-based for large datasets
4. **Lazy Loading**: Load relationships on demand
5. **Connection Pooling**: Database connection management
6. **CDN**: Static asset delivery

## Scalability Considerations

1. **Horizontal Scaling**: Stateless API servers
2. **Database Replication**: Read replicas for queries
3. **Queue System**: Background job processing (Bull/RabbitMQ)
4. **Microservices**: Can split modules into services if needed
5. **Load Balancing**: NGINX upstream configuration
