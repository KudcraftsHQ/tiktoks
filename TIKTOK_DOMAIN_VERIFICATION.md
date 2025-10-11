# TikTok Domain Verification Guide

## Overview

TikTok requires **URL ownership verification** when using the `PULL_FROM_URL` method to upload media. This means you must verify that you own the domain hosting your images.

## Why We Need This

Our app uses a **proxy endpoint** (`/api/tiktok/images/[cacheAssetId]`) to serve images to TikTok because:

1. Direct R2 URLs cannot be verified (you don't own Cloudflare's domain)
2. TikTok's photo API doesn't support FILE_UPLOAD (direct binary upload)
3. The proxy serves images from your verified domain

## Setup Steps

### 1. Get Your App's Domain

Your app needs to be deployed with a custom domain. Options:

- **Production**: `https://yourdomain.com`
- **Vercel**: `https://your-project.vercel.app`
- **Development**: For testing only, use `ngrok` or similar to expose localhost

### 2. Add Domain to TikTok Developer Portal

1. Go to [TikTok for Developers](https://developers.tiktok.com/)
2. Log in and select your application
3. Navigate to **URL Properties** or **Domain Settings**
4. Click **Add Domain** or **Add URL Prefix**

### 3. Choose Verification Method

#### Option A: Domain Verification (Recommended)
- **Domain**: `yourdomain.com` (without https://)
- Verifies all URLs under this domain
- Requires DNS TXT record

#### Option B: URL Prefix Verification
- **URL Prefix**: `https://yourdomain.com/api/tiktok/images/`
- Only verifies exact prefix URLs
- Requires verification file

### 4. Complete Verification

#### For Domain Verification:
1. TikTok will provide a TXT record like: `tiktok-verification=abc123xyz`
2. Add this TXT record to your domain's DNS settings
3. Wait for DNS propagation (can take up to 48 hours)
4. Click **Verify** in TikTok portal

#### For URL Prefix Verification:
1. TikTok will provide a verification file or string
2. Create a route in your app to serve the verification response
3. Click **Verify** in TikTok portal

### 5. Environment Variables

Ensure your production environment has the correct app URL:

```bash
# Production
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# Or Vercel (auto-set)
VERCEL_URL=your-project.vercel.app
```

## Image Proxy Endpoint

The proxy endpoint is at: `/api/tiktok/images/[cacheAssetId]`

### Features:
- ✅ Serves images from R2 or original URLs
- ✅ Supports GET, HEAD, and OPTIONS requests
- ✅ CORS enabled for TikTok access
- ✅ Proper caching headers
- ✅ Content-Type forwarding

### Example URL:
```
https://yourdomain.com/api/tiktok/images/550e8400-e29b-41d4-a716-446655440000
```

## Testing Verification

### 1. Test Your Proxy Endpoint

```bash
# Test if image is accessible
curl -I https://yourdomain.com/api/tiktok/images/[your-cache-asset-id]

# Should return:
# HTTP/2 200
# content-type: image/jpeg
# cache-control: public, max-age=31536000, immutable
```

### 2. Test TikTok Upload

1. Upload photos in your app
2. Submit to TikTok
3. Check for `url_ownership_unverified` error
4. If verified correctly, upload should succeed

## Troubleshooting

### Error: "url_ownership_unverified"
- ❌ Domain not verified in TikTok portal
- ❌ Wrong domain in environment variables
- ❌ DNS not propagated yet

### Error: "Failed to fetch image"
- ❌ Cache asset not found
- ❌ R2 credentials invalid
- ❌ Original URL inaccessible

### Error: Image proxy returns 404
- ❌ Invalid cache asset ID
- ❌ Asset deleted from database

## Development vs Production

### Development (localhost)
TikTok cannot access `http://localhost:3000`. Options:
1. Use `ngrok` to expose local server: `ngrok http 3000`
2. Use the ngrok URL for verification
3. Set `NEXT_PUBLIC_APP_URL=https://your-ngrok-url.ngrok.io`

### Production (Vercel/Custom Domain)
1. Deploy to Vercel or your hosting
2. Verify the production domain in TikTok
3. All uploads will work automatically

## Required TikTok Scopes

Ensure your TikTok app has these scopes:
- `video.upload` - For uploading content

## API Rate Limits

- **Upload endpoint**: 6 requests per minute per user access token
- **Image proxy**: No specific TikTok limits (Next.js server limits apply)

## Security Considerations

1. **Public endpoint**: The proxy endpoint is public but requires valid cache asset IDs
2. **Cache asset IDs**: UUIDs provide sufficient entropy to prevent enumeration
3. **Rate limiting**: Consider adding rate limiting to prevent abuse
4. **Monitoring**: Log proxy requests to detect unusual patterns

## Support

If you encounter issues:
1. Check TikTok Developer Portal for verification status
2. Review server logs for proxy endpoint errors
3. Verify environment variables are set correctly
4. Check [TikTok API Documentation](https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide)
