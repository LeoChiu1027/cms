# Content Module Sequence Diagrams

## Architecture: Hybrid Controller Pattern

- **Type-specific endpoints** (`/blogs`, `/products`) for CRUD operations
- **Unified endpoints** (`/contents`) for cross-type queries and version management

---

## 1. Create Blog

```mermaid
sequenceDiagram
    participant Client
    participant Controller as BlogsController
    participant Service as BlogsService
    participant DB as Database

    Client->>Controller: POST /blogs
    Note right of Client: { slug, title, body, excerpt?, tagIds?, ... }

    Controller->>Controller: Validate CreateBlogDto
    Controller->>Service: createBlog(dto, userId)

    Service->>DB: Check slug+locale unique
    alt Slug exists
        Service-->>Controller: ConflictException
        Controller-->>Client: 409 Conflict
    end

    Service->>DB: BEGIN TRANSACTION
    Service->>DB: INSERT contents (contentType: 'blog')
    Service->>DB: INSERT blogs (type-specific data)

    alt Has tagIds
        Service->>DB: Validate tag IDs exist
        Service->>DB: INSERT content_tags
    end

    Service->>DB: COMMIT
    Service->>DB: SELECT blog with relations
    Service-->>Controller: Blog entity

    Controller->>Controller: Serialize BlogResponse
    Controller-->>Client: 201 Created
```

## 2. Get Blog by ID

```mermaid
sequenceDiagram
    participant Client
    participant Controller as BlogsController
    participant Service as BlogsService
    participant DB as Database

    Client->>Controller: GET /blogs/:blogId

    Controller->>Service: getBlog(blogId)

    Service->>DB: SELECT content + blog WHERE id AND deletedAt IS NULL

    alt Blog not found
        Service-->>Controller: NotFoundException
        Controller-->>Client: 404 Not Found
    end

    Service->>DB: Load tags relation

    Service-->>Controller: Blog with relations
    Controller->>Controller: Serialize BlogResponse
    Controller-->>Client: 200 OK
```

## 3. Get Any Content by ID (Unified)

```mermaid
sequenceDiagram
    participant Client
    participant Controller as ContentsController
    participant Service as ContentService
    participant DB as Database

    Client->>Controller: GET /contents/:contentId

    Controller->>Service: getContent(contentId)

    Service->>DB: SELECT content WHERE id AND deletedAt IS NULL

    alt Content not found
        Service-->>Controller: NotFoundException
        Controller-->>Client: 404 Not Found
    end

    Service->>DB: Load type-specific data (blog/product/category)
    Service->>DB: Load tags relation

    Service-->>Controller: Content with type-specific data
    Controller->>Controller: Serialize ContentResponse
    Controller-->>Client: 200 OK
```

## 4. Update Blog

```mermaid
sequenceDiagram
    participant Client
    participant Controller as BlogsController
    participant Service as BlogsService
    participant DB as Database

    Client->>Controller: PATCH /blogs/:blogId
    Note right of Client: { title?, body?, slug?, status?, ... }

    Controller->>Controller: Validate UpdateBlogDto
    Controller->>Service: updateBlog(blogId, dto, userId)

    Service->>DB: SELECT content + blog by ID
    alt Blog not found
        Service-->>Controller: NotFoundException
        Controller-->>Client: 404 Not Found
    end

    alt Slug changed
        Service->>DB: Check new slug+locale unique
        alt Slug exists
            Service-->>Controller: ConflictException
            Controller-->>Client: 409 Conflict
        end
    end

    Service->>DB: BEGIN TRANSACTION
    Service->>DB: UPDATE contents SET updatedBy, updatedAt
    Service->>DB: UPDATE blogs SET title, body, ...
    Service->>DB: COMMIT

    Service->>DB: SELECT updated blog with relations
    Service-->>Controller: Updated Blog

    Controller->>Controller: Serialize BlogResponse
    Controller-->>Client: 200 OK
```

## 5. Create Content Version (Manual)

```mermaid
sequenceDiagram
    participant Client
    participant Controller as ContentsController
    participant Service as ContentService
    participant DB as Database

    Client->>Controller: POST /contents/:contentId/versions
    Note right of Client: { changeSummary: "Before redesign" }

    Controller->>Service: createVersion(contentId, dto, userId)

    Service->>DB: SELECT content with type-specific data
    alt Content not found
        Service-->>Controller: NotFoundException
        Controller-->>Client: 404 Not Found
    end

    Service->>Service: Build data snapshot (JSONB)
    Note right of Service: Includes base + type-specific fields

    Service->>DB: SELECT MAX(version_number) for content
    Service->>Service: newVersionNumber = max + 1

    Service->>DB: INSERT content_versions
    Note right of DB: { content_id, version_number, data_snapshot, change_summary, created_by }

    Service-->>Controller: ContentVersion entity
    Controller-->>Client: 201 Created
```

## 6. Restore Content to Version

```mermaid
sequenceDiagram
    participant Client
    participant Controller as ContentsController
    participant Service as ContentService
    participant DB as Database

    Client->>Controller: POST /contents/:contentId/versions/:versionId/restore

    Controller->>Service: restoreVersion(contentId, versionId, userId)

    Service->>DB: SELECT content_version by ID
    alt Version not found
        Service-->>Controller: NotFoundException
        Controller-->>Client: 404 Not Found
    end

    Service->>Service: Parse data_snapshot JSONB

    Service->>DB: BEGIN TRANSACTION

    Service->>Service: Create new version snapshot (pre-restore state)
    Service->>DB: INSERT content_versions (backup current state)

    Service->>DB: UPDATE contents with snapshot data
    Service->>DB: UPDATE blogs/products with type-specific data
    Service->>DB: UPDATE contents.version = version + 1

    Service->>DB: COMMIT

    Service->>DB: SELECT restored content with relations
    Service-->>Controller: Restored Content
    Controller-->>Client: 200 OK
```

## 7. Add Tags to Blog

```mermaid
sequenceDiagram
    participant Client
    participant Controller as BlogsController
    participant Service as BlogsService
    participant DB as Database

    Client->>Controller: POST /blogs/:blogId/tags
    Note right of Client: { tagIds: ["uuid1", "uuid2"] }

    Controller->>Controller: Validate DTO
    Controller->>Service: addTags(blogId, tagIds)

    Service->>DB: SELECT content by ID (type: blog)
    alt Blog not found
        Service-->>Controller: NotFoundException
        Controller-->>Client: 404 Not Found
    end

    Service->>DB: SELECT tags WHERE id IN (tagIds)
    alt Some tags not found
        Service-->>Controller: BadRequestException
        Controller-->>Client: 400 Bad Request
    end

    Service->>DB: SELECT existing content_tags
    Service->>Service: Filter out already assigned tags

    loop For each new tag
        Service->>DB: INSERT content_tags
    end

    Service->>DB: SELECT all tags for blog
    Service-->>Controller: Tag list
    Controller-->>Client: 200 OK
```

## 8. List All Contents (Unified)

```mermaid
sequenceDiagram
    participant Client
    participant Controller as ContentsController
    participant Service as ContentService
    participant DB as Database

    Client->>Controller: GET /contents?contentType=blog&status=published&page=1&limit=20

    Controller->>Service: listContents(filters, pagination)

    Service->>Service: Build WHERE clause
    Note right of Service: contentType, status, createdBy, isFeatured, search

    Service->>DB: SELECT COUNT(*) FROM contents WHERE ...
    Service->>DB: SELECT contents with type-specific data WHERE ... LIMIT 20 OFFSET 0

    Service->>Service: Calculate totalPages

    Service-->>Controller: { data: Content[], meta: PaginationMeta }
    Controller->>Controller: Serialize each content
    Controller-->>Client: 200 OK
```

## 9. List Blogs (Type-Specific)

```mermaid
sequenceDiagram
    participant Client
    participant Controller as BlogsController
    participant Service as BlogsService
    participant DB as Database

    Client->>Controller: GET /blogs?status=published&isFeatured=true&page=1&limit=20

    Controller->>Service: listBlogs(filters, pagination)

    Service->>Service: Build WHERE clause
    Note right of Service: status, isFeatured, search, createdBy

    Service->>DB: SELECT COUNT(*) FROM contents WHERE contentType='blog' AND ...
    Service->>DB: SELECT contents + blogs with relations WHERE ... LIMIT 20 OFFSET 0

    Service->>Service: Calculate totalPages

    Service-->>Controller: { data: Blog[], meta: PaginationMeta }
    Controller->>Controller: Serialize BlogListResponse
    Controller-->>Client: 200 OK
```

## 10. Tag CRUD Operations

### Create Tag
```mermaid
sequenceDiagram
    participant Client
    participant Controller as TagsController
    participant Service as TagsService
    participant DB as Database

    Client->>Controller: POST /tags
    Note right of Client: { name: "Technology", slug: "technology" }

    Controller->>Controller: Validate DTO
    Controller->>Service: createTag(dto)

    Service->>DB: SELECT tag WHERE slug = dto.slug
    alt Slug exists
        Service-->>Controller: ConflictException
        Controller-->>Client: 409 Conflict
    end

    Service->>DB: INSERT tags
    Service-->>Controller: Tag entity
    Controller-->>Client: 201 Created
```

### List Tags
```mermaid
sequenceDiagram
    participant Client
    participant Controller as TagsController
    participant Service as TagsService
    participant DB as Database

    Client->>Controller: GET /tags?search=tech&page=1&limit=20

    Controller->>Service: listTags(filters, pagination)

    Service->>DB: SELECT COUNT(*) FROM tags WHERE name ILIKE '%tech%'
    Service->>DB: SELECT tags WHERE name ILIKE '%tech%' LIMIT 20 OFFSET 0

    Service-->>Controller: { data: Tag[], meta: PaginationMeta }
    Controller-->>Client: 200 OK
```

### Delete Tag
```mermaid
sequenceDiagram
    participant Client
    participant Controller as TagsController
    participant Service as TagsService
    participant DB as Database

    Client->>Controller: DELETE /tags/:id

    Controller->>Service: deleteTag(id)

    Service->>DB: SELECT tag by ID
    alt Tag not found
        Service-->>Controller: NotFoundException
        Controller-->>Client: 404 Not Found
    end

    Service->>DB: DELETE content_tags WHERE tag_id = id
    Service->>DB: DELETE tags WHERE id = id

    Service-->>Controller: void
    Controller-->>Client: 204 No Content
```

## 11. Publish Blog (Auto-Version)

```mermaid
sequenceDiagram
    participant Client
    participant Controller as BlogsController
    participant Service as BlogsService
    participant DB as Database

    Client->>Controller: PATCH /blogs/:blogId
    Note right of Client: { status: "published" }

    Controller->>Service: updateBlog(blogId, dto, userId)

    Service->>DB: SELECT content + blog with type-specific data
    alt Blog not found
        Service-->>Controller: NotFoundException
        Controller-->>Client: 404 Not Found
    end

    Service->>Service: Detect status change to "published"

    rect rgb(240, 248, 255)
        Note over Service,DB: Auto-create version on publish
        Service->>Service: Build data snapshot (JSONB)
        Service->>DB: SELECT MAX(version_number) for content
        Service->>DB: INSERT content_versions
        Note right of DB: changeSummary: "Published version"
    end

    Service->>DB: UPDATE contents SET status = 'published', publishedAt = NOW()
    Service->>DB: UPDATE contents.version = version + 1

    Service->>DB: SELECT updated blog with relations
    Service-->>Controller: Updated Blog
    Controller-->>Client: 200 OK
```

## 12. Soft Delete Blog

```mermaid
sequenceDiagram
    participant Client
    participant Controller as BlogsController
    participant Service as BlogsService
    participant DB as Database

    Client->>Controller: DELETE /blogs/:blogId

    Controller->>Service: deleteBlog(blogId)

    Service->>DB: SELECT content by ID WHERE deletedAt IS NULL AND contentType = 'blog'
    alt Blog not found
        Service-->>Controller: NotFoundException
        Controller-->>Client: 404 Not Found
    end

    Service->>DB: UPDATE contents SET deletedAt = NOW()
    Note right of DB: Soft delete - data preserved

    Service-->>Controller: void
    Controller-->>Client: 204 No Content
```

---

## Endpoint Summary (Hybrid Pattern)

### Type-Specific Endpoints (Blogs)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /blogs | Create blog |
| GET | /blogs | List blogs (filtered) |
| GET | /blogs/:blogId | Get blog by ID |
| PATCH | /blogs/:blogId | Update blog |
| DELETE | /blogs/:blogId | Soft delete blog |
| POST | /blogs/:blogId/tags | Add tags to blog |
| GET | /blogs/:blogId/tags | Get blog's tags |
| DELETE | /blogs/:blogId/tags | Remove tags from blog |

### Unified Endpoints (Cross-Type)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /contents | List all content types |
| GET | /contents/:contentId | Get any content by ID |
| GET | /contents/:contentId/versions | List versions |
| POST | /contents/:contentId/versions | Create version snapshot |
| GET | /contents/:contentId/versions/:versionId | Get specific version |
| POST | /contents/:contentId/versions/:versionId/restore | Restore to version |

### Tag Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /tags | Create tag |
| GET | /tags | List tags |
| GET | /tags/:id | Get tag by ID |
| DELETE | /tags/:id | Delete tag |
