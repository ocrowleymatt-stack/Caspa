/**
 * Must be imported first from server.ts so .env exists before other modules
 * read API keys at load time.
 */
import dotenv from 'dotenv';

dotenv.config();
