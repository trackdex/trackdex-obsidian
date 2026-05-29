/**
 * Decompress `.fit.gz` payload to raw FIT bytes.
 * Uses `DecompressionStream` (Node 18+ / Obsidian desktop & mobile WebViews).
 */
export async function gunzipFit(bytes: Uint8Array): Promise<Uint8Array> {
	const stream = new Blob([bytes]).stream().pipeThrough(
		new DecompressionStream("gzip"),
	);
	const buffer = await new Response(stream).arrayBuffer();
	return new Uint8Array(buffer);
}
