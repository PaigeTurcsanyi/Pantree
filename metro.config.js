const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite on web runs SQLite compiled to WebAssembly, which needs the
// .wasm asset served and cross-origin isolation headers for SharedArrayBuffer.
config.resolver.assetExts.push('wasm');

/** Path the web build calls instead of Open Food Facts directly. */
const OFF_PROXY_PATH = '/__off-search';
const OFF_SEARCH_URL = 'https://search.openfoodfacts.org/search';

/**
 * Open Food Facts' search service answers fine but sends no
 * access-control-allow-origin header, so a browser discards every response.
 * Native builds are unaffected (CORS is a browser rule), but the web build
 * needs the request relayed through the dev server. Nothing here runs in a
 * production native build.
 */
async function proxyOffSearch(req, res) {
  const query = req.url.slice(req.url.indexOf('?') + 1);
  try {
    const upstream = await fetch(`${OFF_SEARCH_URL}?${query}`, {
      headers: { 'User-Agent': 'Pantree/0.1 (personal pantry app)' },
    });
    const body = await upstream.text();
    res.statusCode = upstream.status;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(body);
  } catch (error) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(JSON.stringify({ error: String(error) }));
  }
}

config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

    if (req.url && req.url.startsWith(OFF_PROXY_PATH)) {
      void proxyOffSearch(req, res);
      return;
    }
    middleware(req, res, next);
  };
};

module.exports = config;
