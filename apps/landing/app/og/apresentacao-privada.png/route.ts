import { staticCardHandler } from "../../../lib/og-image";
import { PRIVATE_COVER } from "../../../lib/presentation-meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Fixed share card, the same for every request: see presentation-meta.ts. */
export const GET = staticCardHandler(PRIVATE_COVER);
