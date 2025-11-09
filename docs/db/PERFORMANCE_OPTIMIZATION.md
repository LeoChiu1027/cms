# Performance Optimization for Multi-Type Content Search

This document covers strategies to optimize search performance when querying different fields across various content types (products, blog posts, etc.).

---

## Problem Statement

When searching across different content types, you need to:
- Search `custom_fields->>'price'` for products
- Search `custom_fields->>'reading_time'` for blog posts
- Search standard fields like `title`, `body`, `excerpt`
- Maintain fast query performance as data grows

---

## Solution 1: JSONB Indexes (Recommended)

PostgreSQL supports indexing JSONB fields using GIN (Generalized Inverted Index) and expression indexes.

### A. GIN Index for Full JSONB Search

```sql
-- Index entire custom_fields column for containment queries
CREATE INDEX idx_content_custom_fields_gin 
ON content USING gin (custom_fields);

-- Now fast queries like:
SELECT * FROM content 
WHERE custom_fields @> '{"is_featured": true}';
```

### B. Expression Index for Specific Fields

```sql
-- Index specific JSONB fields that are frequently queried
CREATE INDEX idx_content_price 
ON content ((custom_fields->>'price')) 
WHERE content_type_id = '550e8400-e29b-41d4-a716-446655440002'; -- Products only

CREATE INDEX idx_content_sku 
ON content ((custom_fields->>'sku')) 
WHERE content_type_id = '550e8400-e29b-41d4-a716-446655440002';

CREATE INDEX idx_content_reading_time 
ON content ((custom_fields->>'reading_time')) 
WHERE content_type_id = '550e8400-e29b-41d4-a716-446655440001'; -- Blog posts only

-- For numeric comparisons
CREATE INDEX idx_content_price_numeric 
ON content (((custom_fields->>'price')::decimal)) 
WHERE content_type_id = '550e8400-e29b-41d4-a716-446655440002';
```

### C. Combined Index for Common Queries

```sql
-- Composite index for content type + status + custom field
CREATE INDEX idx_content_type_status_price 
ON content (content_type_id, status, ((custom_fields->>'price')::decimal));

-- Fast for queries like:
SELECT * FROM content 
WHERE content_type_id = 'product-type-id' 
  AND status = 'published'
  AND (custom_fields->>'price')::decimal < 1000;
```

---

## Solution 2: Full-Text Search

For searching text content across title, body, excerpt, and custom fields.

### A. Add tsvector Column

```sql
-- Add to content table in DBML
ALTER TABLE content ADD COLUMN search_vector tsvector;

-- Create GIN index on search vector
CREATE INDEX idx_content_search_vector ON content USING gin(search_vector);
```

Update DBML schema:
```dbml
Table content {
  // ... existing fields
  search_vector tsvector [note: 'Full-text search vector']
  
  indexes {
    search_vector [type: gin]
  }
}
```

### B. Populate Search Vector

```sql
-- Function to update search vector
CREATE OR REPLACE FUNCTION content_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.excerpt, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.body, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.meta_description, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update on insert/update
CREATE TRIGGER content_search_vector_trigger
BEFORE INSERT OR UPDATE ON content
FOR EACH ROW EXECUTE FUNCTION content_search_vector_update();

-- Update existing records
UPDATE content SET search_vector = 
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(body, '')), 'C') ||
  setweight(to_tsvector('english', coalesce(meta_description, '')), 'D');
```

### C. Search Queries

```sql
-- Basic full-text search
SELECT id, title, 
       ts_rank(search_vector, query) as rank
FROM content, 
     to_tsquery('english', 'nestjs & typescript') as query
WHERE search_vector @@ query
  AND status = 'published'
ORDER BY rank DESC;

-- With custom fields search (for products)
SELECT c.id, c.title,
       c.custom_fields->>'price' as price,
       ts_rank(c.search_vector, query) as rank
FROM content c,
     to_tsquery('english', 'smartphone') as query
WHERE c.search_vector @@ query
  AND c.content_type_id = 'product-type-id'
  AND c.status = 'published'
ORDER BY rank DESC;
```

---

## Solution 3: PostgreSQL Partitioning

For large datasets, partition by content type.

### A. Create Partitioned Table

```sql
-- Create partitioned table
CREATE TABLE content_partitioned (
  -- same schema as content table
  id uuid PRIMARY KEY,
  content_type_id uuid NOT NULL,
  title varchar(255) NOT NULL,
  -- ... all other fields
) PARTITION BY LIST (content_type_id);

-- Create partitions per content type
CREATE TABLE content_blog_posts PARTITION OF content_partitioned
  FOR VALUES IN ('550e8400-e29b-41d4-a716-446655440001');

CREATE TABLE content_products PARTITION OF content_partitioned
  FOR VALUES IN ('550e8400-e29b-41d4-a716-446655440002');

CREATE TABLE content_landing_pages PARTITION OF content_partitioned
  FOR VALUES IN ('550e8400-e29b-41d4-a716-446655440003');

-- Create indexes on each partition
CREATE INDEX idx_blog_posts_status ON content_blog_posts(status);
CREATE INDEX idx_blog_posts_search ON content_blog_posts USING gin(search_vector);

CREATE INDEX idx_products_price ON content_products(((custom_fields->>'price')::decimal));
CREATE INDEX idx_products_status ON content_products(status);
```

**Pros**: Queries automatically scan only relevant partitions  
**Cons**: More complex schema management

---

## Solution 4: Materialized Views for Complex Queries

Create pre-computed views for expensive queries.

### A. Product Search View

```sql
CREATE MATERIALIZED VIEW mv_product_search AS
SELECT 
  c.id,
  c.title,
  c.slug,
  c.excerpt,
  c.status,
  c.published_at,
  (c.custom_fields->>'price')::decimal as price,
  c.custom_fields->>'sku' as sku,
  (c.custom_fields->>'stock_quantity')::integer as stock,
  c.custom_fields->'specifications' as specifications,
  array_agg(DISTINCT cat.name) as categories,
  array_agg(DISTINCT t.name) as tags,
  c.search_vector
FROM content c
JOIN content_types ct ON c.content_type_id = ct.id
LEFT JOIN content_categories cc ON c.id = cc.content_id
LEFT JOIN categories cat ON cc.category_id = cat.id
LEFT JOIN content_tags ctags ON c.id = ctags.content_id
LEFT JOIN tags t ON ctags.tag_id = t.id
WHERE ct.slug = 'product'
GROUP BY c.id;

-- Create indexes on materialized view
CREATE INDEX idx_mv_product_price ON mv_product_search(price);
CREATE INDEX idx_mv_product_status ON mv_product_search(status);
CREATE INDEX idx_mv_product_search_vector ON mv_product_search USING gin(search_vector);
```

### B. Blog Post Search View

```sql
CREATE MATERIALIZED VIEW mv_blog_post_search AS
SELECT 
  c.id,
  c.title,
  c.slug,
  c.excerpt,
  c.status,
  c.published_at,
  c.author_id,
  u.username as author_name,
  (c.custom_fields->>'reading_time')::integer as reading_time,
  (c.custom_fields->>'is_featured')::boolean as is_featured,
  array_agg(DISTINCT cat.name) as categories,
  array_agg(DISTINCT t.name) as tags,
  c.search_vector
FROM content c
JOIN content_types ct ON c.content_type_id = ct.id
JOIN users u ON c.author_id = u.id
LEFT JOIN content_categories cc ON c.id = cc.content_id
LEFT JOIN categories cat ON cc.category_id = cat.id
LEFT JOIN content_tags ctags ON c.id = ctags.content_id
LEFT JOIN tags t ON ctags.tag_id = t.id
WHERE ct.slug = 'blog_post'
GROUP BY c.id, u.username;

CREATE INDEX idx_mv_blog_reading_time ON mv_blog_post_search(reading_time);
CREATE INDEX idx_mv_blog_featured ON mv_blog_post_search(is_featured);
CREATE INDEX idx_mv_blog_search_vector ON mv_blog_post_search USING gin(search_vector);
```

### C. Refresh Strategy

```sql
-- Refresh manually
REFRESH MATERIALIZED VIEW mv_product_search;
REFRESH MATERIALIZED VIEW mv_blog_post_search;

-- Concurrent refresh (non-blocking)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_product_search;

-- Schedule refresh (using cron or scheduler)
-- Option 1: Periodic refresh every hour
-- Option 2: Trigger-based refresh on content changes
```

---

## Solution 5: Elasticsearch Integration

For advanced search requirements, integrate Elasticsearch.

### Architecture

```
NestJS App → PostgreSQL (source of truth)
          ↓
          → Elasticsearch (search index)
```

### A. Install Dependencies

```bash
pnpm add @nestjs/elasticsearch @elastic/elasticsearch
```

### B. Sync Strategy

```typescript
// content.service.ts
@Injectable()
export class ContentService {
  constructor(
    private readonly elasticsearchService: ElasticsearchService,
  ) {}

  async create(createContentDto: CreateContentDto) {
    // 1. Save to PostgreSQL
    const content = await this.contentRepository.save(createContentDto);
    
    // 2. Index in Elasticsearch
    await this.indexContentInElasticsearch(content);
    
    return content;
  }

  private async indexContentInElasticsearch(content: Content) {
    const index = `content_${content.contentType.slug}`;
    
    await this.elasticsearchService.index({
      index,
      id: content.id,
      document: {
        title: content.title,
        excerpt: content.excerpt,
        body: content.body,
        status: content.status,
        published_at: content.publishedAt,
        ...content.customFields, // Flatten custom fields
        categories: content.categories.map(c => c.name),
        tags: content.tags.map(t => t.name),
      },
    });
  }
}
```

### C. Search Implementation

```typescript
async searchProducts(query: string, filters: ProductFilters) {
  const { body } = await this.elasticsearchService.search({
    index: 'content_product',
    body: {
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query,
                fields: ['title^3', 'excerpt^2', 'body'],
              },
            },
          ],
          filter: [
            { term: { status: 'published' } },
            {
              range: {
                price: {
                  gte: filters.minPrice,
                  lte: filters.maxPrice,
                },
              },
            },
          ],
        },
      },
      aggs: {
        price_ranges: {
          range: {
            field: 'price',
            ranges: [
              { to: 500 },
              { from: 500, to: 1000 },
              { from: 1000 },
            ],
          },
        },
      },
    },
  });

  return body.hits.hits;
}
```

---

## Solution 6: Redis Caching

Cache frequently accessed queries.

```typescript
@Injectable()
export class ContentService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async getFeaturedProducts(): Promise<Content[]> {
    const cacheKey = 'featured_products';
    
    // Check cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Query database
    const products = await this.contentRepository.find({
      where: {
        contentType: { slug: 'product' },
        status: 'published',
        customFields: { path: ['is_featured'], equals: true },
      },
      take: 10,
    });
    
    // Cache for 1 hour
    await this.redis.set(cacheKey, JSON.stringify(products), 'EX', 3600);
    
    return products;
  }
}
```

---

## Recommended Strategy by Scale

### Small Scale (< 100K records)
✅ **Use**: JSONB indexes + Full-text search  
- Simple, built-in PostgreSQL features
- Low maintenance overhead

```sql
CREATE INDEX idx_content_custom_fields_gin ON content USING gin (custom_fields);
CREATE INDEX idx_content_search_vector ON content USING gin(search_vector);
CREATE INDEX idx_content_type_status ON content(content_type_id, status);
```

### Medium Scale (100K - 1M records)
✅ **Use**: JSONB indexes + Materialized views + Redis cache  
- Pre-compute expensive joins
- Cache hot data in Redis
- Refresh materialized views periodically

### Large Scale (> 1M records)
✅ **Use**: Elasticsearch + Redis + PostgreSQL  
- PostgreSQL for transactional data
- Elasticsearch for advanced search
- Redis for caching
- Optional: Partition PostgreSQL tables

---

## Performance Monitoring Queries

```sql
-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE tablename = 'content'
ORDER BY idx_scan DESC;

-- Find slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE query LIKE '%content%'
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Analyze query performance
EXPLAIN ANALYZE
SELECT * FROM content
WHERE content_type_id = 'product-id'
  AND (custom_fields->>'price')::decimal < 1000
  AND status = 'published';
```

---

## Implementation Checklist

- [ ] Add JSONB GIN index on `custom_fields`
- [ ] Add expression indexes for frequently queried custom fields
- [ ] Add `search_vector` column with GIN index
- [ ] Create trigger to auto-update `search_vector`
- [ ] Create materialized views for complex queries (optional)
- [ ] Set up Redis caching for hot data
- [ ] Configure Elasticsearch if needed (large scale)
- [ ] Monitor query performance with `pg_stat_statements`
- [ ] Set up automated materialized view refresh (if using)
- [ ] Add database connection pooling (PgBouncer)

---

## Conclusion

**For most CMS use cases, start with:**

1. **JSONB GIN indexes** - Fast and simple
2. **Full-text search with tsvector** - Built-in PostgreSQL feature
3. **Redis caching** - For frequently accessed data
4. **Materialized views** - For complex aggregations

Only introduce Elasticsearch if you need:
- Multi-language search
- Complex faceting/aggregations
- Typo tolerance
- > 1M records with heavy search traffic
