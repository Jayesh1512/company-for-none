// Verify the Agent API partner key: GET /v1/whoami.
// Reads NEAR_INTENTS_AGENT_API_KEY from the repo .env (never printed).
import path from 'node:path';
import {loadEnvFile} from 'node:process';

try { loadEnvFile(path.resolve('.env')); } catch (error) { if (error.code !== 'ENOENT') throw error; }

const key = process.env.NEAR_INTENTS_AGENT_API_KEY;
const base = process.env.NEAR_INTENTS_AGENT_API_URL ?? 'https://api.agentsonintents.com';
if (!key) { console.error('NEAR_INTENTS_AGENT_API_KEY is empty in .env'); process.exit(2); }

const response = await fetch(`${base}/v1/whoami`, {headers: {'X-API-Key': key}, redirect: 'error'});
const body = await response.text();
console.log('HTTP', response.status);
console.log(body.slice(0, 500));
