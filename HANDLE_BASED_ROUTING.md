# Handle-Based Profile Routing

This document describes the migration from ID-based to handle-based profile URLs.

## Overview

Profile detail pages now use TikTok usernames (handles) in the URL instead of database IDs, providing cleaner and more user-friendly URLs.

## URL Structure

### Before (ID-based)
```
/profiles/clx123abc456        ❌ Unclear, not memorable
```

### After (Handle-based)
```
/profiles/username            ✅ Clean, memorable, shareable
```

## Implementation

### 1. Route Structure
- **Path**: `/profiles/[handle]`
- **Dynamic Route**: `src/app/profiles/[handle]/page.tsx`
- **API Endpoint**: `/api/tiktok/profiles/by-handle/[handle]`

### 2. API Lookup
The new API endpoint fetches profiles by handle:

```typescript
GET /api/tiktok/profiles/by-handle/{handle}
```

**Features**:
- Automatically strips `@` prefix if provided
- Returns 404 if profile not found
- Includes all profile data and aggregated metrics

### 3. Updated Components

**Profile Links**:
- `ProfilesTable` - Row click and "View All Posts" button
- `profiles-table-columns` - "View Posts" action button
- `my-profiles` page - "View Details" button

All links now use:
```tsx
<Link href={`/profiles/${profile.handle}`}>
```

### 4. URL Examples

```
/profiles/mrwhosetheboss
/profiles/khaby.lame
/profiles/charlidamelio
```

## Benefits

1. **User-Friendly**: URLs are readable and memorable
2. **Shareable**: Easy to share profile links
3. **SEO**: Better for search engine optimization
4. **Cleaner**: Matches TikTok's own URL structure

## Technical Details

### Database Lookup
- Uses `handle` field (unique index) for fast lookups
- Handle is stored without `@` prefix in database
- URL accepts handle with or without `@` prefix

### Backwards Compatibility
- Old ID-based routes have been removed
- All internal links updated to use handles
- API endpoints for monitoring/posts still use ID internally

### Route File Structure
```
src/app/profiles/
├── page.tsx                           # Profiles list page
└── [handle]/
    └── page.tsx                       # Profile detail page (handle-based)

src/app/api/tiktok/profiles/
├── by-handle/
│   └── [handle]/
│       └── route.ts                   # Handle-based profile API
└── [id]/                              # ID-based APIs (monitoring, posts, etc.)
    ├── route.ts
    ├── monitoring/
    ├── own/
    └── posts/
```

## Migration Notes

- ✅ All profile links migrated to use handles
- ✅ Old ID-based route removed
- ✅ API endpoint created for handle lookup
- ✅ Build passes successfully
- ⚠️  Existing monitoring/posts APIs still use profile ID internally (this is fine)

## Future Considerations

- Consider adding URL redirects from old ID-based URLs if needed
- Monitor for any edge cases with special characters in handles
- Ensure handle uniqueness is maintained at database level
