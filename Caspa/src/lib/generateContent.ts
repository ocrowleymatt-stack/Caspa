/**
 * Cloud Function: generateContent
 * Securely calls Google GenAI API with server-side API key
 * Prevents client-side API key exposure
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generai';

// Initialize Firebase Admin SDK
admin.initializeApp();

const apiKey = process.env.GOOGLE_GENAI_API_KEY;
if (!apiKey) {
  throw new Error('GOOGLE_GENAI_API_KEY not set in Cloud Function environment');
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

interface GenerateContentRequest {
  prompt: string;
  projectId: string;
  userId: string;
}

interface GenerateContentResponse {
  text: string;
  timestamp: number;
}

/**
 * Generate content securely on the backend
 */
export const generateContent = functions.https.onCall(
  async (data: GenerateContentRequest, context) => {
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { prompt, projectId } = data;
    const uid = context.auth.uid;

    // Verify user owns this project (optional but recommended)
    // Could check Firestore to ensure uid has access to projectId
    if (!prompt) {
      throw new functions.https.HttpsError('invalid-argument', 'Prompt is required');
    }

    try {
      // Call GenAI API
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      // Log usage (optional - for tracking/billing)
      await admin
        .firestore()
        .collection('usage')
        .add({
          uid,
          projectId,
          type: 'generateContent',
          promptLength: prompt.length,
          responseLength: text.length,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

      return {
        text,
        timestamp: Date.now(),
      } as GenerateContentResponse;
    } catch (error) {
      console.error('GenAI error:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to generate content: ' + (error as Error).message
      );
    }
  }
);

/**
 * Extract text from PDF file
 * Files uploaded to Cloud Storage
 */
export const extractPdfText = functions.storage.object().onFinalize(async object => {
  const bucket = admin.storage().bucket();
  const file = bucket.file(object.name);

  // Only process PDFs
  if (!object.name?.endsWith('.pdf')) {
    return;
  }

  try {
    // Download file to temp
    const tempPath = `/tmp/${object.name}`;
    await file.download({ destination: tempPath });

    // Extract text (would use pdfjs-dist or similar library)
    // For now, mark as processed in Firestore
    const docId = object.name?.split('/')[1]; // Extract project ID
    if (docId) {
      await admin.firestore().collection('uploads').doc(docId).update({
        status: 'processed',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  } catch (error) {
    console.error('PDF extraction error:', error);
  }
});

/**
 * Validate rate limiting (optional)
 * Prevent abuse of API
 */
export const checkRateLimit = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const uid = context.auth.uid;
  const oneHourAgo = Date.now() - 60 * 60 * 1000;

  // Check usage in past hour
  const usage = await admin
    .firestore()
    .collection('usage')
    .where('uid', '==', uid)
    .where('timestamp', '>', oneHourAgo)
    .get();

  const limit = 100; // Calls per hour
  const remaining = limit - usage.size;

  return {
    remaining,
    limit,
    canProceed: remaining > 0,
  };
});
