/*
 * Cloudflare R2 Storage Library
 * 
 * Required Environment Variables:
 * - R2_ACCOUNT_ID: Your Cloudflare account ID
 * - R2_ACCESS_KEY_ID: R2 API token access key ID
 * - R2_SECRET_ACCESS_KEY: R2 API token secret access key
 * - R2_BUCKET_NAME: Your R2 bucket name
 * - R2_PUBLIC_URL: Your R2 bucket public URL (optional if using custom domain)
 * - R2_CUSTOM_DOMAIN: Your custom domain for the bucket (optional)
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Initialize R2 client
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME!;
const PUBLIC_URL = process.env.R2_CUSTOM_DOMAIN || process.env.R2_PUBLIC_URL;

/**
 * Upload a file to R2 storage
 */
export async function uploadToR2(
  file: File,
  folder: string = 'images'
): Promise<{ url: string; key: string }> {
  try {
    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.name.split('.').pop();
    const key = `${folder}/${timestamp}-${randomId}.${fileExtension}`;

    // Convert file to buffer
    const buffer = await file.arrayBuffer();

    // Upload to R2
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: new Uint8Array(buffer),
      ContentType: file.type,
      CacheControl: 'public, max-age=31536000', // 1 year cache
    });

    await r2Client.send(command);

    // Return the public URL
    const url = `${PUBLIC_URL}/${key}`;
    
    return { url, key };
  } catch (error) {
    console.error('Error uploading to R2:', error);
    throw new Error('Failed to upload image');
  }
}

/**
 * Upload multiple files to R2 storage
 */
export async function uploadMultipleToR2(
  files: File[],
  folder: string = 'images'
): Promise<Array<{ url: string; key: string; originalName: string }>> {
  try {
    const uploadPromises = files.map(async (file) => {
      const result = await uploadToR2(file, folder);
      return {
        ...result,
        originalName: file.name,
      };
    });

    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error('Error uploading multiple files to R2:', error);
    throw new Error('Failed to upload one or more images');
  }
}

/**
 * Delete a file from R2 storage
 */
export async function deleteFromR2(key: string): Promise<void> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await r2Client.send(command);
  } catch (error) {
    console.error('Error deleting from R2:', error);
    throw new Error('Failed to delete image');
  }
}

/**
 * Generate a presigned URL for direct upload from client
 */
export async function generatePresignedUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600 // 1 hour
): Promise<string> {
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    return await getSignedUrl(r2Client, command, { expiresIn });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    throw new Error('Failed to generate upload URL');
  }
}

/**
 * Extract key from R2 URL
 */
export function extractKeyFromUrl(url: string): string {
  const baseUrl = PUBLIC_URL;
  if (url.startsWith(baseUrl!)) {
    return url.replace(`${baseUrl}/`, '');
  }
  throw new Error('Invalid R2 URL');
}

/**
 * Convert R2 key to public URL
 */
export function keyToUrl(key: string): string {
  return `${PUBLIC_URL}/${key}`;
}

/**
 * Convert array of keys to URLs
 */
export function keysToUrls(keys: string[]): string[] {
  return keys.map(key => keyToUrl(key));
}

/**
 * Validate environment variables
 */
export function validateR2Config(): void {
  const required = [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required R2 environment variables: ${missing.join(', ')}`);
  }

  if (!process.env.R2_PUBLIC_URL && !process.env.R2_CUSTOM_DOMAIN) {
    throw new Error('Either R2_PUBLIC_URL or R2_CUSTOM_DOMAIN must be set');
  }
} 