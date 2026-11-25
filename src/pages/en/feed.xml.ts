import type { APIRoute } from 'astro';
import { feedResponse, versionFeed } from '../../lib/feed';

export const GET: APIRoute = async () => feedResponse(await versionFeed('en'));
