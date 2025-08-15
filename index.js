const functions = require('firebase-functions');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp();

// Initialize Gemini AI with your project's API key
const genAI = new GoogleGenerativeAI(functions.config().gemini.api_key);

/**
 * Firebase Cloud Function for Gemini AI generation
 * This serves as an alternative to Firebase AI Logic
 */
exports.generateWithGemini = functions
    .region('asia-northeast1') // Tokyo region
    .https
    .onCall(async (data, context) => {
        try {
            // Authentication check (optional)
            if (!context.auth) {
                throw new functions.https.HttpsError(
                    'unauthenticated',
                    'The function must be called while authenticated.'
                );
            }

            // Validate input
            const { prompt } = data;
            if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Prompt is required and must be a non-empty string.'
                );
            }

            if (prompt.length > 8000) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Prompt is too long. Maximum 8000 characters allowed.'
                );
            }

            // Rate limiting check (optional)
            const userId = context.auth.uid;
            const rateLimitRef = admin.firestore()
                .collection('rateLimits')
                .doc(userId);
            
            const rateLimitDoc = await rateLimitRef.get();
            const now = Date.now();
            const oneHour = 60 * 60 * 1000;
            
            if (rateLimitDoc.exists) {
                const data = rateLimitDoc.data();
                if (now - data.lastReset < oneHour && data.count >= 20) {
                    throw new functions.https.HttpsError(
                        'resource-exhausted',
                        'Rate limit exceeded. Try again later.'
                    );
                }
            }

            // Generate content with Gemini
            const model = genAI.getGenerativeModel({ 
                model: 'gemini-pro',
                generationConfig: {
                    temperature: 0.7,
                    topP: 0.8,
                    topK: 40,
                    maxOutputTokens: 2048,
                }
            });

            console.log(`Generating content for user: ${userId}, prompt length: ${prompt.length}`);

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Update rate limit
            const currentCount = rateLimitDoc.exists ? 
                (now - rateLimitDoc.data().lastReset < oneHour ? rateLimitDoc.data().count + 1 : 1) : 1;
            
            await rateLimitRef.set({
                count: currentCount,
                lastReset: rateLimitDoc.exists && now - rateLimitDoc.data().lastReset < oneHour ? 
                    rateLimitDoc.data().lastReset : now
            });

            // Log usage (optional)
            await admin.firestore()
                .collection('usage_logs')
                .add({
                    userId: userId,
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    promptLength: prompt.length,
                    responseLength: text.length,
                    model: 'gemini-pro'
                });

            return {
                response: text,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Error in generateWithGemini:', error);

            // Handle specific Gemini API errors
            if (error.message?.includes('API_KEY_INVALID')) {
                throw new functions.https.HttpsError(
                    'internal',
                    'AI service configuration error.'
                );
            }

            if (error.message?.includes('QUOTA_EXCEEDED')) {
                throw new functions.https.HttpsError(
                    'resource-exhausted',
                    'AI service quota exceeded. Please try again later.'
                );
            }

            if (error.message?.includes('SAFETY')) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Content was blocked due to safety policies.'
                );
            }

            // Re-throw Firebase errors
            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            // Generic error
            throw new functions.https.HttpsError(
                'internal',
                'Failed to generate content.'
            );
        }
    });

/**
 * HTTP endpoint version (for direct HTTP calls)
 */
exports.generateWithGeminiHttp = functions
    .region('asia-northeast1')
    .https
    .onRequest(async (req, res) => {
        // CORS handling
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }

        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }

        try {
            const { prompt, idToken } = req.body;

            // Verify ID token
            let decodedToken;
            try {
                decodedToken = await admin.auth().verifyIdToken(idToken);
            } catch (error) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            // Validate prompt
            if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
                res.status(400).json({ error: 'Invalid prompt' });
                return;
            }

            // Generate content
            const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            res.status(200).json({
                response: text,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error in HTTP endpoint:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

/**
 * Cleanup function for old logs (runs daily)
 */
exports.cleanupLogs = functions
    .region('asia-northeast1')
    .pubsub
    .schedule('0 2 * * *') // Daily at 2 AM JST
    .timeZone('Asia/Tokyo')
    .onRun(async (context) => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const batch = admin.firestore().batch();
        const oldLogs = await admin.firestore()
            .collection('usage_logs')
            .where('timestamp', '<', thirtyDaysAgo)
            .limit(500)
            .get();

        oldLogs.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        console.log(`Deleted ${oldLogs.docs.length} old log entries`);
    });