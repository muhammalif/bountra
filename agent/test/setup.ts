// Loaded before any test module. Forces the offline path so `pnpm test` never
// touches the network or the developer's real GEMINI_API_KEY.
//
// docs/RULES.md §6 requires the AI evaluator to be tested against a mock
// response; §7 requires external calls to be resilient. Before this file,
// `import "dotenv/config"` in src/index.ts pulled the developer's real key in
// and the suite silently made live Gemini calls — one test failed whenever
// Google returned 503, and passed only by accident when the key was absent.
process.env.GEMINI_API_KEY = "";
delete process.env.GEMINI_PRIMARY_MODEL;
delete process.env.GEMINI_FALLBACK_MODEL;
