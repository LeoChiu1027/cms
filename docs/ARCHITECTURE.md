# CMS Architecture Documentation

## High-Level System Overview

```mermaid
graph TB
    CLIENT[Client Applications]-->GATEWAY[API Gateway]
    GATEWAY-->APP[NestJS Application]
    APP-->DATA[Data Layer]
    
    style CLIENT fill:#e1f5ff
    style GATEWAY fill:#fff3e0
    style APP fill:#e8f5e9
    style DATA fill:#fce4ec
```

### Layer Breakdown

- **Client Layer**: Web Dashboard, Mobile Apps, API Clients
- **API Gateway**: NGINX (Load Balancing, Rate Limiting, SSL)
- **Application Layer**: NestJS Modules (Auth, RBAC, Content, Workflow, Approval)
- **Data Layer**: PostgreSQL, Redis, S3

---

## Complete System Architecture

```mermaid
graph TB
    subgraph CLIENT_LAYER["📱 Client Layer"]
        WEB[Web Dashboard]
        MOBILE[Mobile Apps]
        API_CLIENT[API Clients]
    end

    subgraph GATEWAY_LAYER["🚪 API Gateway"]
        NGINX[NGINX]
    end

    subgraph APP_LAYER["⚙️ NestJS Application"]
        direction TB
        
        subgraph AUTH_LAYER["🔐 Security"]
            AUTH[Auth]
            RBAC[RBAC Guard]
        end
        
        subgraph CORE_LAYER["👥 Core"]
            USERS[Users]
            ROLES[Roles]
            PERMS[Permissions]
        end
        
        subgraph CMS_LAYER["📝 CMS"]
            CONTENT[Content]
            WORKFLOW[Workflow]
            APPROVAL[Approval]
            MEDIA[Media]
            CATEGORIES[Categories]
        end
        
        subgraph SUPPORT_LAYER["🔔 Support"]
            NOTIF[Notifications]
            AUDIT[Audit Logs]
        end
    end

    subgraph DATA_LAYER["💾 Data Layer"]
        direction LR
        DB[(PostgreSQL)]
        REDIS[(Redis)]
        S3[S3 Storage]
    end

    %% Client to Gateway
    WEB --> NGINX
    MOBILE --> NGINX
    API_CLIENT --> NGINX
    
    %% Gateway to Auth
    NGINX --> AUTH
    
    %% Auth flows
    AUTH --> RBAC
    RBAC -.checks.-> PERMS
    
    %% Core relationships
    USERS -.has.-> ROLES
    ROLES -.has.-> PERMS
    
    %% CMS flows
    CONTENT --> WORKFLOW
    WORKFLOW --> APPROVAL
    CONTENT -.uses.-> MEDIA
    CONTENT -.categorized by.-> CATEGORIES
    
    %% Support services
    APPROVAL --> NOTIF
    CONTENT -.logs to.-> AUDIT
    APPROVAL -.logs to.-> AUDIT
    
    %% Data layer connections
    USERS --> DB
    ROLES --> DB
    CONTENT --> DB
    WORKFLOW --> DB
    APPROVAL --> DB
    
    RBAC -.cache.-> REDIS
    AUTH -.sessions.-> REDIS
    
    MEDIA --> S3
    
    %% Styling
    style CLIENT_LAYER fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    style GATEWAY_LAYER fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style APP_LAYER fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    style DATA_LAYER fill:#fce4ec,stroke:#c2185b,stroke-width:2px
    
    style AUTH_LAYER fill:#ffcdd2
    style CORE_LAYER fill:#bbdefb
    style CMS_LAYER fill:#c8e6c9
    style SUPPORT_LAYER fill:#fff9c4
```

---

## Detailed Architecture Views

### 1. Application Layer Architecture

```mermaid
graph TB
    subgraph "Auth & Security Layer"
        AUTH[Auth Module]
        GUARD[RBAC Guard]
    end
    
    subgraph "Core Modules"
        USER[Users]
        ROLE[Roles]
        PERM[Permissions]
    end
    
    subgraph "CMS Modules"
        CONTENT[Content]
        WORKFLOW[Workflow]
        APPROVAL[Approval]
        MEDIA[Media]
        CATEGORY[Categories]
    end
    
    subgraph "Supporting Services"
        NOTIF[Notifications]
        AUDIT[Audit Logs]
    end
    
    AUTH-->GUARD
    GUARD-->PERM
    USER-->ROLE-->PERM
    
    CONTENT-->WORKFLOW-->APPROVAL
    CONTENT-->MEDIA
    CONTENT-->CATEGORY
    
    APPROVAL-->NOTIF
    CONTENT-->AUDIT
    APPROVAL-->AUDIT
    
    style AUTH fill:#ffcdd2
    style GUARD fill:#ffcdd2
    style USER fill:#bbdefb
    style ROLE fill:#bbdefb
    style PERM fill:#bbdefb
    style CONTENT fill:#c8e6c9
    style WORKFLOW fill:#c8e6c9
    style APPROVAL fill:#c8e6c9
    style MEDIA fill:#c8e6c9
    style CATEGORY fill:#c8e6c9
```

### 2. Data Layer Architecture

```mermaid
graph LR
    APP[Application]
    
    subgraph "Persistent Storage"
        DB[(PostgreSQL<br/>Primary Data)]
    end
    
    subgraph "Cache Layer"
        REDIS[(Redis<br/>Session & Cache)]
    end
    
    subgraph "Object Storage"
        S3[S3<br/>Media Files]
    end
    
    APP-->|User/Content/Workflow|DB
    APP-->|Permissions/Session|REDIS
    APP-->|Images/Files|S3
    
    style DB fill:#e1bee7
    style REDIS fill:#ffccbc
    style S3 fill:#c5e1a5
```

### 3. Request Flow Through Layers

```mermaid
graph LR
    CLIENT[Client]-->NGINX[NGINX]
    NGINX-->AUTH[Auth Check]
    AUTH-->RBAC[Permission Check]
    RBAC-->CONTROLLER[Controller]
    CONTROLLER-->SERVICE[Service]
    SERVICE-->DB[(Database)]
    
    style CLIENT fill:#e3f2fd
    style NGINX fill:#fff9c4
    style AUTH fill:#ffccbc
    style RBAC fill:#ffccbc
    style CONTROLLER fill:#c8e6c9
    style SERVICE fill:#c8e6c9
    style DB fill:#e1bee7
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
