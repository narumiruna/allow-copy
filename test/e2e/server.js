const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const HOST = "127.0.0.1";
const PORT = 4173;
const ROOT = path.resolve(__dirname, "../..");

const CONTENT_TYPES = {
	".css": "text/css; charset=utf-8",
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".png": "image/png",
	".svg": "image/svg+xml; charset=utf-8",
};

function resolveRequestPath(urlPathname) {
	const normalizedPath =
		urlPathname === "/" ? "/test-restriction.html" : urlPathname;
	const filePath = path.resolve(ROOT, `.${normalizedPath}`);
	if (!filePath.startsWith(ROOT)) {
		return null;
	}
	return filePath;
}

const server = http.createServer(async (request, response) => {
	const requestUrl = new URL(request.url, `http://${request.headers.host}`);
	const filePath = resolveRequestPath(requestUrl.pathname);

	if (!filePath) {
		response.writeHead(403);
		response.end("Forbidden");
		return;
	}

	try {
		const file = await fs.readFile(filePath);
		const ext = path.extname(filePath);
		response.writeHead(200, {
			"Content-Type": CONTENT_TYPES[ext] || "application/octet-stream",
			"Cache-Control": "no-store",
		});
		response.end(file);
	} catch (_error) {
		response.writeHead(404);
		response.end("Not Found");
	}
});

server.listen(PORT, HOST, () => {
	console.log(`Test server running at http://${HOST}:${PORT}`);
});
