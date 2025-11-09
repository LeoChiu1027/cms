# Sample Data Examples

This document demonstrates how the CMS schema handles different content types with real-world examples.

---

## 1. Content Types Setup

First, we define different content types with their custom schemas:

### Blog Post
```sql
INSERT INTO content_types (id, name, slug, schema) VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  'Blog Post',
  'blog_post',
  '{
    "fields": [
      {
        "name": "reading_time",
        "type": "integer",
        "label": "Reading Time (minutes)"
      },
      {
        "name": "author_bio",
        "type": "text",
        "label": "Author Bio"
      },
      {
        "name": "is_featured",
        "type": "boolean",
        "label": "Featured Post"
      }
    ]
  }'
);
```

### Product
```sql
INSERT INTO content_types (id, name, slug, schema) VALUES (
  '550e8400-e29b-41d4-a716-446655440002',
  'Product',
  'product',
  '{
    "fields": [
      {
        "name": "price",
        "type": "decimal",
        "label": "Price"
      },
      {
        "name": "sku",
        "type": "string",
        "label": "SKU"
      },
      {
        "name": "stock_quantity",
        "type": "integer",
        "label": "Stock Quantity"
      },
      {
        "name": "specifications",
        "type": "json",
        "label": "Product Specifications"
      }
    ]
  }'
);
```

### Landing Page
```sql
INSERT INTO content_types (id, name, slug, schema) VALUES (
  '550e8400-e29b-41d4-a716-446655440003',
  'Landing Page',
  'landing_page',
  '{
    "fields": [
      {
        "name": "hero_image",
        "type": "string",
        "label": "Hero Image URL"
      },
      {
        "name": "cta_text",
        "type": "string",
        "label": "Call to Action Text"
      },
      {
        "name": "cta_link",
        "type": "string",
        "label": "Call to Action Link"
      },
      {
        "name": "sections",
        "type": "json",
        "label": "Page Sections"
      }
    ]
  }'
);
```

---

## 2. Categories Setup

```sql
-- Parent Categories
INSERT INTO categories (id, name, slug, parent_id) VALUES
  ('cat-001', 'Technology', 'technology', NULL),
  ('cat-002', 'Business', 'business', NULL),
  ('cat-003', 'Electronics', 'electronics', NULL),
  ('cat-004', 'Clothing', 'clothing', NULL);

-- Child Categories (Subcategories)
INSERT INTO categories (id, name, slug, parent_id) VALUES
  ('cat-011', 'Software Development', 'software-development', 'cat-001'),
  ('cat-012', 'AI & Machine Learning', 'ai-ml', 'cat-001'),
  ('cat-021', 'Startups', 'startups', 'cat-002'),
  ('cat-022', 'Marketing', 'marketing', 'cat-002'),
  ('cat-031', 'Smartphones', 'smartphones', 'cat-003'),
  ('cat-032', 'Laptops', 'laptops', 'cat-003');
```

---

## 3. Tags

```sql
INSERT INTO tags (id, name, slug) VALUES
  ('tag-001', 'TypeScript', 'typescript'),
  ('tag-002', 'NestJS', 'nestjs'),
  ('tag-003', 'Tutorial', 'tutorial'),
  ('tag-004', 'Best Practices', 'best-practices'),
  ('tag-005', 'iPhone', 'iphone'),
  ('tag-006', 'Android', 'android'),
  ('tag-007', 'Review', 'review');
```

---

## 4. Sample Content Examples

### Example 1: Blog Post

```sql
-- Blog Post Content
INSERT INTO content (
  id,
  content_type_id,
  title,
  slug,
  excerpt,
  body,
  custom_fields,
  status,
  author_id,
  meta_title,
  meta_description
) VALUES (
  'content-001',
  '550e8400-e29b-41d4-a716-446655440001', -- Blog Post type
  'Building Scalable APIs with NestJS',
  'building-scalable-apis-nestjs',
  'Learn how to build production-ready REST APIs using NestJS framework and best practices.',
  '# Introduction\n\nNestJS is a powerful Node.js framework...\n\n## Architecture\n\nWe will use modular architecture...',
  '{
    "reading_time": 12,
    "author_bio": "John Doe is a senior software engineer with 10 years of experience.",
    "is_featured": true
  }',
  'published',
  'user-001',
  'Building Scalable APIs with NestJS - Complete Guide',
  'A comprehensive tutorial on building production-ready REST APIs using NestJS framework'
);

-- Assign to categories
INSERT INTO content_categories (content_id, category_id) VALUES
  ('content-001', 'cat-001'), -- Technology
  ('content-001', 'cat-011'); -- Software Development

-- Assign tags
INSERT INTO content_tags (content_id, tag_id) VALUES
  ('content-001', 'tag-001'), -- TypeScript
  ('content-001', 'tag-002'), -- NestJS
  ('content-001', 'tag-003'); -- Tutorial
```

### Example 2: Product (Smartphone)

```sql
-- Product Content
INSERT INTO content (
  id,
  content_type_id,
  title,
  slug,
  excerpt,
  body,
  custom_fields,
  featured_image_id,
  status,
  author_id
) VALUES (
  'content-002',
  '550e8400-e29b-41d4-a716-446655440002', -- Product type
  'iPhone 15 Pro Max',
  'iphone-15-pro-max',
  'The most powerful iPhone ever with titanium design and A17 Pro chip.',
  '## Features\n\n- 6.7-inch Super Retina XDR display\n- A17 Pro chip\n- Pro camera system\n- Titanium design',
  '{
    "price": 1199.99,
    "sku": "IPHONE-15-PRO-MAX-256GB",
    "stock_quantity": 50,
    "specifications": {
      "display": "6.7-inch OLED",
      "processor": "A17 Pro",
      "ram": "8GB",
      "storage": "256GB",
      "camera": "48MP + 12MP + 12MP",
      "battery": "4422mAh",
      "colors": ["Natural Titanium", "Blue Titanium", "White Titanium", "Black Titanium"]
    }
  }',
  'media-001',
  'published',
  'user-002'
);

-- Assign to categories
INSERT INTO content_categories (content_id, category_id) VALUES
  ('content-002', 'cat-003'), -- Electronics
  ('content-002', 'cat-031'); -- Smartphones

-- Assign tags
INSERT INTO content_tags (content_id, tag_id) VALUES
  ('content-002', 'tag-005'), -- iPhone
  ('content-002', 'tag-007'); -- Review
```

### Example 3: Landing Page (Marketing Campaign)

```sql
-- Landing Page Content
INSERT INTO content (
  id,
  content_type_id,
  title,
  slug,
  excerpt,
  body,
  custom_fields,
  status,
  author_id,
  scheduled_publish_at
) VALUES (
  'content-003',
  '550e8400-e29b-41d4-a716-446655440003', -- Landing Page type
  'Black Friday 2024 - Mega Sale',
  'black-friday-2024',
  'Up to 70% off on electronics. Limited time offer!',
  'Join our biggest sale of the year with amazing discounts across all categories.',
  '{
    "hero_image": "https://cdn.example.com/black-friday-hero.jpg",
    "cta_text": "Shop Now",
    "cta_link": "/shop/black-friday",
    "sections": [
      {
        "type": "hero",
        "heading": "Black Friday Mega Sale",
        "subheading": "Up to 70% Off",
        "background_color": "#000000"
      },
      {
        "type": "featured_products",
        "title": "Hot Deals",
        "product_ids": ["content-002", "product-123", "product-456"]
      },
      {
        "type": "countdown",
        "end_date": "2024-11-29T23:59:59Z"
      }
    ]
  }',
  'approved',
  'user-003',
  '2024-11-24T00:00:00Z' -- Scheduled for Black Friday
);

-- Assign to categories
INSERT INTO content_categories (content_id, category_id) VALUES
  ('content-003', 'cat-002'), -- Business
  ('content-003', 'cat-022'); -- Marketing
```

---

## 5. Workflow Examples

### Standard Editorial Workflow

```sql
-- Create Workflow
INSERT INTO workflows (id, name, description, is_default, created_by) VALUES (
  'workflow-001',
  'Standard Editorial Workflow',
  'Three-step approval process for blog posts',
  true,
  'user-admin'
);

-- Step 1: Content Review
INSERT INTO workflow_steps (id, workflow_id, name, step_order, required_approvals) VALUES (
  'step-001',
  'workflow-001',
  'Content Review',
  1,
  1
);

-- Assign to Editor role
INSERT INTO workflow_step_assignees (workflow_step_id, assignee_type, role_id) VALUES (
  'step-001',
  'role',
  'role-editor'
);

-- Step 2: SEO Review
INSERT INTO workflow_steps (id, workflow_id, name, step_order, required_approvals) VALUES (
  'step-002',
  'workflow-001',
  'SEO Review',
  2,
  1
);

-- Assign to SEO Specialist role
INSERT INTO workflow_step_assignees (workflow_step_id, assignee_type, role_id) VALUES (
  'step-002',
  'role',
  'role-seo-specialist'
);

-- Step 3: Final Approval
INSERT INTO workflow_steps (id, workflow_id, name, step_order, required_approvals) VALUES (
  'step-003',
  'workflow-001',
  'Final Approval',
  3,
  1
);

-- Assign to Publisher role
INSERT INTO workflow_step_assignees (workflow_step_id, assignee_type, role_id) VALUES (
  'step-003',
  'role',
  'role-publisher'
);
```

### Product Approval Workflow (More Complex)

```sql
-- Create Product Workflow
INSERT INTO workflows (id, name, description, content_type_id, is_active, created_by) VALUES (
  'workflow-002',
  'Product Launch Workflow',
  'Multi-step approval for new products',
  '550e8400-e29b-41d4-a716-446655440002', -- Product type
  true,
  'user-admin'
);

-- Step 1: Product Manager Review
INSERT INTO workflow_steps (id, workflow_id, name, step_order, required_approvals) VALUES (
  'step-011',
  'workflow-002',
  'Product Manager Review',
  1,
  1
);

-- Step 2: Legal Review (for product descriptions)
INSERT INTO workflow_steps (id, workflow_id, name, step_order, required_approvals) VALUES (
  'step-012',
  'workflow-002',
  'Legal Review',
  2,
  1
);

-- Step 3: Marketing Approval (requires 2 approvals)
INSERT INTO workflow_steps (id, workflow_id, name, step_order, required_approvals) VALUES (
  'step-013',
  'workflow-002',
  'Marketing Approval',
  3,
  2 -- Requires 2 marketing team approvals
);

-- Step 4: Final Launch Approval
INSERT INTO workflow_steps (id, workflow_id, name, step_order, required_approvals) VALUES (
  'step-014',
  'workflow-002',
  'Launch Approval',
  4,
  1
);
```

---

## 6. Approval Request Example

```sql
-- Author submits blog post for approval
INSERT INTO approval_requests (
  id,
  content_id,
  workflow_id,
  current_step_id,
  status,
  requested_by,
  notes
) VALUES (
  'approval-001',
  'content-001',
  'workflow-001',
  'step-001', -- Starting at Content Review
  'pending',
  'user-001',
  'Please review and approve this blog post for publication.'
);

-- Editor approves content review
INSERT INTO approval_actions (
  id,
  approval_request_id,
  workflow_step_id,
  reviewer_id,
  action,
  comments
) VALUES (
  'action-001',
  'approval-001',
  'step-001',
  'user-editor',
  'approved',
  'Content looks great. Minor typo fixed in paragraph 3.'
);

-- Update approval request to next step
UPDATE approval_requests 
SET current_step_id = 'step-002' 
WHERE id = 'approval-001';

-- SEO Specialist requests changes
INSERT INTO approval_actions (
  id,
  approval_request_id,
  workflow_step_id,
  reviewer_id,
  action,
  comments
) VALUES (
  'action-002',
  'approval-001',
  'step-002',
  'user-seo',
  'requested_changes',
  'Please add focus keywords in the meta description and first paragraph.'
);

-- Move back to author
UPDATE approval_requests 
SET status = 'rejected', current_step_id = NULL
WHERE id = 'approval-001';
```

---

## 7. RBAC Examples

### Roles and Permissions Setup

```sql
-- Create Roles
INSERT INTO roles (id, name, description, is_system_role) VALUES
  ('role-admin', 'Admin', 'Full system access', true),
  ('role-editor', 'Editor', 'Can review and edit all content', false),
  ('role-author', 'Author', 'Can create and edit own content', false),
  ('role-reviewer', 'Reviewer', 'Can approve content', false),
  ('role-publisher', 'Publisher', 'Can publish approved content', false);

-- Create Permissions
INSERT INTO permissions (id, resource, action, description) VALUES
  ('perm-001', 'content', 'create', 'Create new content'),
  ('perm-002', 'content', 'read', 'View content'),
  ('perm-003', 'content', 'update', 'Edit content'),
  ('perm-004', 'content', 'delete', 'Delete content'),
  ('perm-005', 'content', 'publish', 'Publish content'),
  ('perm-006', 'content', 'approve', 'Approve content in workflow'),
  ('perm-007', 'user', 'manage', 'Manage users'),
  ('perm-008', 'role', 'manage', 'Manage roles'),
  ('perm-009', 'workflow', 'manage', 'Manage workflows');

-- Assign Permissions to Roles

-- Admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id) VALUES
  ('role-admin', 'perm-001'),
  ('role-admin', 'perm-002'),
  ('role-admin', 'perm-003'),
  ('role-admin', 'perm-004'),
  ('role-admin', 'perm-005'),
  ('role-admin', 'perm-006'),
  ('role-admin', 'perm-007'),
  ('role-admin', 'perm-008'),
  ('role-admin', 'perm-009');

-- Author permissions
INSERT INTO role_permissions (role_id, permission_id) VALUES
  ('role-author', 'perm-001'), -- create
  ('role-author', 'perm-002'), -- read
  ('role-author', 'perm-003'); -- update (own content only)

-- Editor permissions
INSERT INTO role_permissions (role_id, permission_id) VALUES
  ('role-editor', 'perm-002'), -- read
  ('role-editor', 'perm-003'), -- update
  ('role-editor', 'perm-006'); -- approve

-- Publisher permissions
INSERT INTO role_permissions (role_id, permission_id) VALUES
  ('role-publisher', 'perm-002'), -- read
  ('role-publisher', 'perm-005'), -- publish
  ('role-publisher', 'perm-006'); -- approve

-- Assign Roles to Users
INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES
  ('user-001', 'role-author', 'user-admin'),
  ('user-002', 'role-editor', 'user-admin'),
  ('user-003', 'role-publisher', 'user-admin'),
  ('user-admin', 'role-admin', 'user-admin');
```

---

## 8. Querying Examples

### Get all published blog posts with their categories and tags

```sql
SELECT 
  c.id,
  c.title,
  c.slug,
  c.excerpt,
  c.published_at,
  ct.name as content_type,
  u.username as author,
  array_agg(DISTINCT cat.name) as categories,
  array_agg(DISTINCT t.name) as tags
FROM content c
JOIN content_types ct ON c.content_type_id = ct.id
JOIN users u ON c.author_id = u.id
LEFT JOIN content_categories cc ON c.id = cc.content_id
LEFT JOIN categories cat ON cc.category_id = cat.id
LEFT JOIN content_tags ctags ON c.id = ctags.content_id
LEFT JOIN tags t ON ctags.tag_id = t.id
WHERE c.status = 'published'
  AND ct.slug = 'blog_post'
GROUP BY c.id, ct.name, u.username
ORDER BY c.published_at DESC;
```

### Get products in a category with price range

```sql
SELECT 
  c.id,
  c.title,
  c.excerpt,
  c.custom_fields->>'price' as price,
  c.custom_fields->>'sku' as sku,
  c.custom_fields->>'stock_quantity' as stock
FROM content c
JOIN content_types ct ON c.content_type_id = ct.id
JOIN content_categories cc ON c.id = cc.content_id
JOIN categories cat ON cc.category_id = cat.id
WHERE ct.slug = 'product'
  AND cat.slug = 'smartphones'
  AND c.status = 'published'
  AND (c.custom_fields->>'price')::decimal BETWEEN 500 AND 1500
ORDER BY (c.custom_fields->>'price')::decimal ASC;
```

### Get content pending approval for a specific user

```sql
SELECT 
  c.id,
  c.title,
  c.status,
  ar.status as approval_status,
  ws.name as current_step,
  ar.requested_at
FROM content c
JOIN approval_requests ar ON c.id = ar.content_id
JOIN workflow_steps ws ON ar.current_step_id = ws.id
JOIN workflow_step_assignees wsa ON ws.id = wsa.workflow_step_id
WHERE wsa.user_id = 'user-editor'
  AND ar.status = 'pending'
ORDER BY ar.requested_at ASC;
```

### Check if user has permission

```sql
SELECT EXISTS (
  SELECT 1
  FROM user_roles ur
  JOIN role_permissions rp ON ur.role_id = rp.role_id
  JOIN permissions p ON rp.permission_id = p.id
  WHERE ur.user_id = 'user-001'
    AND p.resource = 'content'
    AND p.action = 'publish'
) as has_permission;
```

---

## Key Takeaways

1. **Content Types** are flexible - each type can define its own custom fields via JSON schema
2. **Categories** are hierarchical - you can have parent/child relationships
3. **Tags** are flat and many-to-many with content
4. **Workflows** can be content-type specific or global
5. **Approval Steps** can require multiple approvers and be assigned to users or roles
6. **RBAC** is fine-grained at resource + action level
7. **Custom Fields** in JSONB allow querying with PostgreSQL JSON operators
