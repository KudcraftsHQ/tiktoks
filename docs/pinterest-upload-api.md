# Pinterest Upload API Documentation

## Overview

This API allows uploading Pinterest pin images to the asset management system. Images are automatically organized into a shared "Pinterest" folder and deduplicated based on the Pinterest pin URL.

## Base URL

```
https://your-domain.com/api
```

## Authentication

Currently no authentication required (add authentication headers here when implemented).

## Endpoint

### Upload Pinterest Pin Image

Upload a single Pinterest pin image to assets.

**Endpoint:** `POST /assets/from-pinterest`

**Content-Type:** `application/json`

#### Request Body

```json
{
  "imageUrl": "string",    // Required: Direct URL to the image file
  "pinUrl": "string",      // Required: Pinterest pin URL (used for deduplication)
  "name": "string",        // Optional: Custom name for the asset
  "force": false           // Optional: Force re-upload even if exists (default: false)
}
```

#### Request Example

```json
{
  "imageUrl": "https://i.pinimg.com/originals/abc/def/123.jpg",
  "pinUrl": "https://www.pinterest.com/pin/123456789/",
  "name": "My Pin Image"
}
```

#### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "asset": {
    "id": "clx1234567890",
    "cacheAssetId": "550e8400-e29b-41d4-a716-446655440000",
    "folderId": "clx9876543210",
    "name": "My Pin Image",
    "width": 1080,
    "height": 1920,
    "sourceType": "pinterest",
    "sourceUrl": "https://www.pinterest.com/pin/123456789/",
    "createdAt": "2025-11-18T09:30:15.000Z",
    "updatedAt": "2025-11-18T09:30:15.000Z",
    "url": "https://your-cdn.com/assets/pinterest/1234567890-abc123.jpg"
  }
}
```

#### Error Responses

**Duplicate Asset (Status 409)**

When the pin URL already exists in the system:

```json
{
  "error": "Asset already exists",
  "code": "DUPLICATE_ASSET",
  "existingAssetId": "clx1234567890"
}
```

**Validation Error (Status 400)**

When required fields are missing:

```json
{
  "error": "imageUrl and pinUrl are required"
}
```

**Download/Upload Error (Status 500)**

When image download or upload fails:

```json
{
  "error": "Failed to upload Pinterest asset",
  "details": "Failed to download image: Not Found"
}
```

## Behavior Notes

1. **Automatic Folder Creation:** All Pinterest uploads are automatically placed in a shared "Pinterest" folder. The folder is created automatically if it doesn't exist.

2. **Deduplication:** The system prevents duplicate uploads by checking the `pinUrl`. If a pin has already been uploaded, the API returns a `409 Conflict` error with the existing asset ID.

3. **Force Mode:** Set `force: true` to bypass duplicate checking and re-upload the image.

4. **Image Processing:** The system automatically:
   - Downloads the image from the provided URL
   - Extracts image dimensions (width/height)
   - Uploads to R2 storage
   - Creates database entries for caching and asset management

5. **File Naming:** If no custom name is provided, the system generates a name like `pinterest-1731923415000.jpg`

## Usage Example (JavaScript)

```javascript
async function uploadPinterestPin(imageUrl, pinUrl, customName) {
  try {
    const response = await fetch('/api/assets/from-pinterest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageUrl: imageUrl,
        pinUrl: pinUrl,
        name: customName
      })
    });

    const data = await response.json();

    if (!response.ok) {
      if (data.code === 'DUPLICATE_ASSET') {
        console.log('Pin already uploaded:', data.existingAssetId);
      } else {
        console.error('Upload failed:', data.error);
      }
      return null;
    }

    console.log('Upload successful:', data.asset.id);
    return data.asset;
  } catch (error) {
    console.error('Network error:', error);
    return null;
  }
}

// Usage
uploadPinterestPin(
  'https://i.pinimg.com/originals/abc/def/123.jpg',
  'https://www.pinterest.com/pin/123456789/',
  'Beautiful Design Inspiration'
);
```

## Chrome Extension Integration

### Recommended Flow

1. **Extract Pin Data:** Extract the pin URL and image URL from the Pinterest page
2. **Check for Duplicates:** Optionally call the API first without uploading to check if it exists
3. **Upload Image:** POST the image data to the endpoint
4. **Handle Response:** Show success/error UI to the user
5. **Visual Indicator:** Store the uploaded asset IDs locally to show indicators on previously uploaded pins

### Example: Bulk Upload

For uploading multiple pins from a Pinterest board:

```javascript
async function uploadMultiplePins(pins) {
  const results = {
    success: [],
    duplicates: [],
    errors: []
  };

  for (const pin of pins) {
    const result = await uploadPinterestPin(
      pin.imageUrl,
      pin.pinUrl,
      pin.title
    );

    if (result) {
      results.success.push(result);
    } else {
      // Check if duplicate or error
      // Handle accordingly
    }

    // Add delay to avoid rate limiting (if implemented)
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}
```

## Future Enhancements

The following features are planned but not yet implemented:

- [ ] Bulk upload endpoint for multiple pins at once
- [ ] Check status endpoint (`GET /assets/check-sources?urls=url1,url2`)
- [ ] Instagram support
- [ ] Rate limiting
- [ ] Authentication/API keys
- [ ] Webhook notifications for successful uploads

## Support

For issues or questions, please contact the development team or create an issue in the project repository.
