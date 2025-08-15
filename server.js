const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { genkit } = require('@genkit-ai/core');
const { googleAI } = require('@genkit-ai/googleai');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    methods: ['POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parser
app.use(express.json({ limit: '10mb' }));

// Initialize Genkit with Google AI plugin
const ai = genkit({
    plugins: [googleAI()],
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        service: 'Genkit Server'
    });
});

// Main generation endpoint
app.post('/generate', async (req, res) => {
    try {
        const { apiKey, prompt } = req.body;
        
        // Validation
        if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
            return res.status(400).json({
                error: 'API key is required and must be a non-empty string'
            });
        }
        
        if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
            return res.status(400).json({
                error: 'Prompt is required and must be a non-empty string'
            });
        }
        
        // Initialize Google Generative AI with user's API key
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ 
            model: "gemini-pro",
            generationConfig: {
                temperature: 0.7,
                topP: 0.8,
                topK: 40,
                maxOutputTokens: 2048,
            }
        });
        
        console.log(`[${new Date().toISOString()}] Generating content for prompt length: ${prompt.length}`);
        
        // Generate content
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        if (!text || text.trim().length === 0) {
            return res.status(500).json({
                error: 'No content was generated'
            });
        }
        
        console.log(`[${new Date().toISOString()}] Successfully generated content length: ${text.length}`);
        
        // Return successful response
        res.status(200).json({
            response: text,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error in /generate:`, {
            message: error.message,
            code: error.code || 'UNKNOWN_ERROR',
            // Don't log the full error object to avoid exposing sensitive info
        });
        
        // Handle specific error types
        if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('invalid API key')) {
            return res.status(401).json({
                error: 'Invalid API key provided'
            });
        }
        
        if (error.message?.includes('quota') || error.message?.includes('QUOTA_EXCEEDED')) {
            return res.status(429).json({
                error: 'API quota exceeded'
            });
        }
        
        if (error.message?.includes('SAFETY')) {
            return res.status(400).json({
                error: 'Content was blocked due to safety concerns'
            });
        }
        
        // Generic error response
        res.status(500).json({
            error: 'Failed to generate content',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// Genkit flow definition (alternative approach using Genkit flows)
const geminiFlow = ai.defineFlow(
    {
        name: 'geminiGenerate',
        inputSchema: z.object({
            apiKey: z.string(),
            prompt: z.string(),
        }),
        outputSchema: z.string(),
    },
    async (input) => {
        const genAI = new GoogleGenerativeAI(input.apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        
        const result = await model.generateContent(input.prompt);
        const response = await result.response;
        return response.text();
    }
);

// Alternative endpoint using Genkit flow
app.post('/generate-flow', async (req, res) => {
    try {
        const { apiKey, prompt } = req.body;
        
        if (!apiKey || !prompt) {
            return res.status(400).json({
                error: 'API key and prompt are required'
            });
        }
        
        const result = await geminiFlow({ apiKey, prompt });
        
        res.status(200).json({
            response: result,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error in /generate-flow:', error);
        res.status(500).json({
            error: 'Failed to generate content'
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(`[${new Date().toISOString()}] Unhandled error:`, err);
    res.status(500).json({
        error: 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint not found'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Genkit Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🤖 Generate endpoint: http://localhost:${PORT}/generate`);
    console.log(`⚡ Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🔄 Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🔄 Received SIGINT, shutting down gracefully...');
    process.exit(0);
});

module.exports = app;