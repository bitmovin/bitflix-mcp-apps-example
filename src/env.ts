import 'dotenv/config';

import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'production']).default('development'),
    // Bitmovin Player license key. Injected into each tool payload so the
    // player can initialize inside the view. Must be authorized for the host's
    // widget-serving domain (same requirement as any MCP App player).
    BITMOVIN_PLAYER_KEY: z.string().default(''),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: false,
});
