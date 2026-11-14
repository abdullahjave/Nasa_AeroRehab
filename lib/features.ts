// Recorded mode needs a writable local SQLite file, which a serverless host (Vercel) cannot keep.
// next.config.ts turns it off on Vercel builds unless NEXT_PUBLIC_RECORDED_MODE=on is set explicitly.
export const RECORDED_ENABLED = process.env.NEXT_PUBLIC_RECORDED_MODE !== "off";
