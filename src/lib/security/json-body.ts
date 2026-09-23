/** Bound memory before parsing an anonymous JSON payload (including chunked requests). */
export async function readJsonBody(request: Request, limit = 4096): Promise<unknown> {
  if (Number(request.headers.get('content-length')) > limit) throw new RangeError('Payload too large')
  const reader = request.body?.getReader()
  if (!reader) return null
  const chunks: Uint8Array[] = []
  let bytes = 0
  while (true) {
    const part = await reader.read()
    if (part.done) break
    bytes += part.value.byteLength
    if (bytes > limit) { await reader.cancel(); throw new RangeError('Payload too large') }
    chunks.push(part.value)
  }
  const combined = new Uint8Array(bytes)
  let offset = 0
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength }
  try { return JSON.parse(new TextDecoder().decode(combined)) } catch { return null }
}
