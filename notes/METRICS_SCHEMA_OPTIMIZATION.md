# Metrics History Schema Optimization

## Current Schema (Good for most use cases)

```prisma
model TikTokPostMetricsHistory {
  id           String   @id @default(cuid())
  postId       String
  viewCount    BigInt?
  likeCount    Int?
  shareCount   Int?
  commentCount Int?
  saveCount    Int?
  recordedAt   DateTime @default(now())

  post         TikTokPost @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@map("tiktok_post_metrics_history")
  @@index([postId, recordedAt])
}
```

## Read Efficiency Analysis

### ✅ What's Already Optimized

1. **Composite Index `[postId, recordedAt]`**
   - Perfect for query: `SELECT * FROM metrics_history WHERE postId = ? ORDER BY recordedAt DESC LIMIT 30`
   - PostgreSQL can use index-only scan
   - Very fast even with millions of rows

2. **Denormalized Structure**
   - No joins needed to get metrics
   - All data in single table

3. **API Limits**
   - We fetch max 30 entries per post
   - Prevents unbounded result sets

### ⚠️ Potential Bottlenecks (at scale)

1. **Unbounded Growth**
   - Each monitored post gets 1 entry per day
   - 100 posts × 365 days = 36,500 rows/year
   - 1,000 posts × 365 days = 365,000 rows/year
   - Still manageable, but grows linearly

2. **No Data Archival**
   - All history kept forever
   - Old data (>90 days) rarely accessed

## Optimization Options

### Option 1: Current Schema (Recommended)
**Use when:**
- < 10,000 monitored posts
- < 1 million history entries
- Read latency < 100ms acceptable

**Pros:**
- Simple, no complexity
- PostgreSQL handles this well
- Index covers most queries

**Cons:**
- Data grows unbounded
- No time-based optimizations

### Option 2: Add Time-Based Partitioning
**Use when:**
- > 10,000 monitored posts
- > 1 million history entries
- Need predictable query performance

**Implementation:**

```sql
-- Create partitioned table
CREATE TABLE tiktok_post_metrics_history (
  id           VARCHAR(30) PRIMARY KEY,
  post_id      VARCHAR(30) NOT NULL,
  view_count   BIGINT,
  like_count   INTEGER,
  share_count  INTEGER,
  comment_count INTEGER,
  save_count   INTEGER,
  recorded_at  TIMESTAMP NOT NULL
) PARTITION BY RANGE (recorded_at);

-- Create monthly partitions
CREATE TABLE metrics_history_2024_01 PARTITION OF tiktok_post_metrics_history
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE metrics_history_2024_02 PARTITION OF tiktok_post_metrics_history
  FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Auto-create future partitions with pg_cron or trigger

-- Index on each partition
CREATE INDEX ON metrics_history_2024_01 (post_id, recorded_at);
CREATE INDEX ON metrics_history_2024_02 (post_id, recorded_at);
```

**Pros:**
- Query only relevant partitions
- Can drop old partitions easily
- Better query planning for time ranges

**Cons:**
- More complex setup
- Need partition management

### Option 3: Aggregation Strategy
**Use when:**
- Need historical trends, not raw data
- Can sacrifice granularity for speed
- Want to reduce storage

**Implementation:**

```prisma
// Keep recent detailed data
model TikTokPostMetricsHistory {
  // ... existing fields
  @@index([postId, recordedAt])
}

// Aggregate old data
model TikTokPostMetricsDaily {
  id           String   @id @default(cuid())
  postId       String
  date         DateTime // Day-level granularity
  avgViewCount BigInt?
  avgLikeCount Int?
  maxViewCount BigInt?
  minViewCount BigInt?
  recordsCount Int     // How many records aggregated

  @@unique([postId, date])
  @@index([postId, date])
}

model TikTokPostMetricsMonthly {
  id           String   @id @default(cuid())
  postId       String
  month        DateTime // Month-level granularity
  avgViewCount BigInt?
  // ... similar to daily

  @@unique([postId, month])
  @@index([postId, month])
}
```

**Background job:**
```typescript
// Run nightly
async function aggregateOldMetrics() {
  // 1. Find metrics older than 30 days
  // 2. Group by post + day
  // 3. Calculate aggregates
  // 4. Insert into daily table
  // 5. Delete raw data older than 30 days
}
```

**Pros:**
- Much smaller storage
- Fast queries for trends
- Can keep detailed data for recent history

**Cons:**
- Loses granular detail for old data
- Requires background job
- More complex queries

### Option 4: Hybrid Approach
**Best of all worlds:**

```prisma
model TikTokPostMetricsHistory {
  id           String   @id @default(cuid())
  postId       String
  viewCount    BigInt?
  // ... other metrics
  recordedAt   DateTime @default(now())

  @@index([postId, recordedAt])
  @@index([recordedAt]) // For archival queries
}
```

**Retention policy:**
- Keep last 90 days in detail (raw table)
- Aggregate 90-365 days to daily
- Aggregate 365+ days to monthly
- Delete raw data > 90 days

**Query pattern:**
```typescript
async function getMetricsHistory(postId: string, days: number = 30) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  if (days <= 90) {
    // Use raw detailed data
    return prisma.tikTokPostMetricsHistory.findMany({
      where: {
        postId,
        recordedAt: { gte: cutoff }
      },
      orderBy: { recordedAt: 'desc' }
    })
  } else if (days <= 365) {
    // Use daily aggregates
    return prisma.tikTokPostMetricsDaily.findMany({
      where: {
        postId,
        date: { gte: cutoff }
      },
      orderBy: { date: 'desc' }
    })
  } else {
    // Use monthly aggregates
    return prisma.tikTokPostMetricsMonthly.findMany({
      where: {
        postId,
        month: { gte: cutoff }
      },
      orderBy: { month: 'desc' }
    })
  }
}
```

## Performance Benchmarks

### Current Schema Performance (Estimated)

| Rows in Table | Query Time (indexed) | Storage |
|--------------|---------------------|---------|
| 100K         | < 10ms              | ~10 MB  |
| 1M           | < 50ms              | ~100 MB |
| 10M          | < 200ms             | ~1 GB   |
| 100M         | < 500ms             | ~10 GB  |

### With Partitioning (Estimated)

| Rows in Table | Query Time | Storage |
|--------------|-----------|---------|
| 10M          | < 50ms    | ~1 GB   |
| 100M         | < 100ms   | ~10 GB  |
| 1B           | < 200ms   | ~100 GB |

## Recommendation

**For your use case, stick with Option 1 (current schema)** because:

1. **Write pattern**: Once per 24 hours per monitored post (very low volume)
2. **Read pattern**: Only when user views post details with `includeHistory=true` (infrequent)
3. **Index efficiency**: Composite `[postId, recordedAt]` index handles reads perfectly
4. **Data volume**: Even with 1,000 monitored posts over 3 years = ~1M rows (easily handled)

**When to upgrade:**
- If you monitor > 10,000 posts
- If history queries become > 200ms
- If table exceeds 10M rows
- If you need analytics/trend features

**Next step if needed:**
- Add Option 4 (Hybrid) with 90-day retention
- Implement background job to aggregate old data
- This keeps system fast while preserving historical trends

## Monitoring Query Performance

```sql
-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename = 'tiktok_post_metrics_history';

-- Check slow queries
SELECT
  query,
  mean_exec_time,
  calls
FROM pg_stat_statements
WHERE query LIKE '%tiktok_post_metrics_history%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```
