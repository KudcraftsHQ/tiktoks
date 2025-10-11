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

import {
	DeleteObjectCommand,
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Initialize R2 client dynamically
function getR2Client() {
	return new S3Client({
		region: "auto",
		endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
		credentials: {
			accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
			secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
		},
	});
}

const getBucketName = () => process.env.R2_BUCKET_NAME;
const getPublicUrl = () => {
	const publicUrl = process.env.R2_CUSTOM_DOMAIN || process.env.R2_PUBLIC_URL;
	console.log('🌐 [R2.getPublicUrl] Environment variables:', {
		R2_CUSTOM_DOMAIN: process.env.R2_CUSTOM_DOMAIN || '(not set)',
		R2_PUBLIC_URL: process.env.R2_PUBLIC_URL || '(not set)',
		resolved: publicUrl || '(none)'
	});
	return publicUrl;
};

/**
 * Upload a file to R2 storage
 */
export async function uploadToR2(
	file: File | Buffer,
	folder: string = "images",
	filename?: string,
	contentType?: string,
): Promise<{ url: string; key: string }> {
	try {
		// Handle both File objects and Buffer
		let buffer: Buffer
		let name: string
		let type: string

		if (Buffer.isBuffer(file)) {
			buffer = file
			name = filename || `file_${Date.now()}`
			type = contentType || 'application/octet-stream'
		} else {
			// File object (browser)
			const arrayBuffer = await file.arrayBuffer()
			buffer = Buffer.from(arrayBuffer)
			name = file.name
			type = file.type
		}

		// Generate unique filename
		const timestamp = Date.now();
		const randomId = Math.random().toString(36).substring(2, 15);
		const fileExtension = name.split(".").pop() || 'bin';
		const key = `${folder}/${timestamp}-${randomId}.${fileExtension}`;

		// Get bucket name and public URL
		const bucketName = getBucketName();
		const publicUrl = getPublicUrl();

		if (!bucketName) {
			throw new Error('R2_BUCKET_NAME environment variable is not set');
		}

		// Upload to R2
		const command = new PutObjectCommand({
			Bucket: bucketName,
			Key: key,
			Body: buffer,
			ContentType: type,
			CacheControl: "public, max-age=31536000", // 1 year cache
		});

		await getR2Client().send(command);

		// Return the public URL
		const url = `${publicUrl}/${key}`;

		return { url, key };
	} catch (error) {
		console.error("Error uploading to R2:", error);
		throw new Error("Failed to upload image");
	}
}

/**
 * Upload multiple files to R2 storage
 */
export async function uploadMultipleToR2(
	files: File[],
	folder: string = "images",
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
		console.error("Error uploading multiple files to R2:", error);
		throw new Error("Failed to upload one or more images");
	}
}

/**
 * Delete a file from R2 storage
 */
export async function deleteFromR2(key: string): Promise<void> {
	try {
		const bucketName = getBucketName();
		if (!bucketName) {
			throw new Error('R2_BUCKET_NAME environment variable is not set');
		}

		const command = new DeleteObjectCommand({
			Bucket: bucketName,
			Key: key,
		});

		await getR2Client().send(command);
	} catch (error) {
		console.error("Error deleting from R2:", error);
		throw new Error("Failed to delete image");
	}
}

/**
 * Generate a presigned URL for direct upload from client
 */
export async function generatePresignedUrl(
	key: string,
	contentType: string,
	expiresIn: number = 3600, // 1 hour
): Promise<string> {
	try {
		const bucketName = getBucketName();
		if (!bucketName) {
			throw new Error('R2_BUCKET_NAME environment variable is not set');
		}

		const command = new PutObjectCommand({
			Bucket: bucketName,
			Key: key,
			ContentType: contentType,
		});

		return await getSignedUrl(getR2Client(), command, { expiresIn });
	} catch (error) {
		console.error("Error generating presigned URL:", error);
		throw new Error("Failed to generate upload URL");
	}
}

/**
 * Extract key from R2 URL
 */
export function extractKeyFromUrl(url: string): string {
	const baseUrl = getPublicUrl();
	if (baseUrl && url.startsWith(baseUrl)) {
		return url.replace(`${baseUrl}/`, "");
	}
	throw new Error("Invalid R2 URL");
}

/**
 * Convert R2 key to public URL
 */
export function keyToUrl(key: string): string {
	console.log('🔑 [R2.keyToUrl] ==================== START ====================');
	console.log('🔑 [R2.keyToUrl] Input key:', key);

	const publicUrl = getPublicUrl();
	console.log('🔑 [R2.keyToUrl] Public URL from env:', publicUrl);

	if (!publicUrl) {
		console.error('❌ [R2.keyToUrl] No public URL configured!');
		throw new Error('R2_PUBLIC_URL or R2_CUSTOM_DOMAIN environment variable is not set');
	}

	const fullUrl = `${publicUrl}/${key}`;
	console.log('🔑 [R2.keyToUrl] Generated URL:', fullUrl);
	console.log('🔑 [R2.keyToUrl] ==================== COMPLETE ====================');

	return fullUrl;
}

/**
 * Convert array of keys to URLs
 */
export function keysToUrls(keys: string[]): string[] {
	return keys.map((key) => keyToUrl(key));
}

/**
 * Generate presigned URLs for multiple keys
 */
export async function generatePresignedUrls(
	keys: string[],
	expiresIn: number = 3600, // 1 hour default
): Promise<{ key: string; url: string }[]> {
	const results = await Promise.all(
		keys.map(async (key) => {
			try {
				const url = await generatePresignedUrl(
					key,
					"application/octet-stream",
					expiresIn,
				);
				return { key, url };
			} catch (error) {
				console.error(`Failed to generate presigned URL for ${key}:`, error);
				return { key, url: keyToUrl(key) }; // Fallback to public URL
			}
		}),
	);

	return results;
}

/**
 * Generate a presigned URL for downloading/viewing a file (GET operation)
 */
export async function generatePresignedGetUrl(
	key: string,
	expiresIn: number = 3600,
): Promise<string> {
	try {
		const bucketName = getBucketName();
		if (!bucketName) {
			throw new Error('R2_BUCKET_NAME environment variable is not set');
		}

		const command = new GetObjectCommand({
			Bucket: bucketName,
			Key: key,
		});

		return await getSignedUrl(getR2Client(), command, { expiresIn });
	} catch (error) {
		console.error(`Failed to generate presigned GET URL for ${key}:`, error);
		return keyToUrl(key); // Fallback to public URL
	}
}

/**
 * Generate a single presigned URL with content type detection
 * @deprecated Use generatePresignedGetUrl for viewing/downloading files
 */
export async function generatePresignedUrlFromKey(
	key: string,
	expiresIn: number = 3600,
): Promise<string> {
	try {
		// For viewing files, use GET operation instead of PUT
		return await generatePresignedGetUrl(key, expiresIn);
	} catch (error) {
		console.error(`Failed to generate presigned URL for ${key}:`, error);
		return keyToUrl(key); // Fallback to public URL
	}
}

/**
 * Get content type from file key/extension
 */
function getContentTypeFromKey(key: string): string {
	const extension = key.split(".").pop()?.toLowerCase();

	const typeMap: Record<string, string> = {
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		png: "image/png",
		webp: "image/webp",
		gif: "image/gif",
		mp4: "video/mp4",
		webm: "video/webm",
		mov: "video/quicktime",
		mp3: "audio/mpeg",
		m4a: "audio/mp4",
		wav: "audio/wav",
		weba: "audio/webm",
	};

	return typeMap[extension || ""] || "application/octet-stream";
}

/**
 * Validate environment variables
 */
export function validateR2Config(): void {
	const required = [
		"R2_ACCOUNT_ID",
		"R2_ACCESS_KEY_ID",
		"R2_SECRET_ACCESS_KEY",
		"R2_BUCKET_NAME",
	];

	const missing = required.filter((key) => !process.env[key]);

	if (missing.length > 0) {
		throw new Error(
			`Missing required R2 environment variables: ${missing.join(", ")}`,
		);
	}

	if (!getPublicUrl()) {
		throw new Error("Either R2_PUBLIC_URL or R2_CUSTOM_DOMAIN must be set");
	}
}
