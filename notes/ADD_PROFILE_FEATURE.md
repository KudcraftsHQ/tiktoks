# Add Profile Feature

This document describes the new "Add Profile" feature that replaced the Profile Explorer page.

## Overview

The Profile Explorer page has been replaced with a simple dialog accessible from the sidebar. Users can now add TikTok profiles directly from the sidebar with a cleaner, more streamlined experience.

## Features

### 1. Add Profile Dialog (Sidebar)
- **Location**: TikTok Profiles section in sidebar
- **Trigger**: "Add Profile" button
- **Inputs**:
  - TikTok handle or profile URL (e.g., `@username` or `https://www.tiktok.com/@username`)
  - "Mark as my profile" toggle

### 2. Profile & Posts Fetching
- **Foreground Processing**:
  - Profile metadata is fetched and created immediately
  - First batch of posts (up to 35) is fetched and saved
  - Returns success/processing status to user

- **Background Processing** (future enhancement):
  - If profile has more posts (`hasMore: true`), additional pages can be fetched in background
  - Currently processes first batch only

### 3. User Experience
- **Success Toast**: Shows when profile is successfully added
- **Processing Toast**: Indicates background processing for remaining posts
- **Auto-refresh**: Refreshes profile lists when on profile pages
- **Loading States**: Button shows spinner while processing

## API Endpoint

### POST `/api/tiktok/profiles/add`

**Request Body**:
```json
{
  "handle": "username",
  "isOwnProfile": false
}
```

**Response**:
```json
{
  "success": true,
  "profile": {
    "id": "...",
    "handle": "username",
    "isOwnProfile": false
  },
  "stats": {
    "created": 25,
    "updated": 10,
    "total": 35
  },
  "processing": false
}
```

## Implementation Details

### Components
- **`AddProfileDialog`** (`src/components/AddProfileDialog.tsx`)
  - Dialog form for adding profiles
  - Handle extraction from URLs or @mentions
  - Toggle for marking as own profile

### API Logic
1. Extract handle from input (supports URLs and @handles)
2. Fetch profile data from ScrapeCreators API
3. Create/update profile with avatar caching
4. Fetch and save first batch of posts (35)
5. Cache all media assets (videos, covers, images, avatars)
6. Update profile aggregated metrics
7. Return success with stats

### Data Flow
```
User Input → Extract Handle → Fetch Profile → Create Profile
                                    ↓
                              Fetch Posts → Cache Media → Save Posts
                                    ↓
                              Update Metrics → Return Success
```

## Removed Features
- ❌ Profile Explorer page (`/profile-explorer`)
- ❌ Profile Explorer navigation link
- ✅ Functionality moved to sidebar dialog

## Future Enhancements
1. **Background Worker**: Queue remaining pages for background fetching
2. **Progress Tracking**: Show real-time progress for multi-page fetches
3. **Batch Processing**: Support adding multiple profiles at once
4. **Error Recovery**: Retry failed posts/media downloads

## Usage

1. Click **"Add Profile"** button in sidebar (TikTok Profiles section)
2. Enter a TikTok handle or profile URL
3. Optionally toggle **"Mark as my profile"**
4. Click **"Add Profile"**
5. Wait for confirmation toast
6. Profile appears in "All Profiles" or "My Profiles" (if marked)

## Technical Notes

- Uses existing `MediaCacheServiceV2` for asset caching
- Leverages `CacheAsset` system for R2 storage
- Integrates with profile monitoring system
- Updates aggregated metrics automatically
- Supports both video and photo posts
