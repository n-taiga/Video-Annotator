/**
 * Multipart Streaming Parser
 *
 * Parses a multipart/mixed HTTP response body as a stream,
 * yielding each part with its headers and body.
 */

const decoder = new TextDecoder()
const encoder = new TextEncoder()
const blankLine = encoder.encode('\r\n')

const STATE_BOUNDARY = 0
const STATE_HEADERS = 1
const STATE_BODY = 2

export interface MultipartPart {
  headers: Headers
  body: Uint8Array
}

/**
 * Compares two Uint8Array objects for equality.
 */
function compareArrays(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false
    }
  }
  return true
}

interface BoundaryInfo {
  boundary: Uint8Array
  closingBoundary: Uint8Array
}

/**
 * Parses a Content-Type into multipart boundaries.
 * @returns boundary lines (normal and closing), or null if invalid
 */
function getBoundary(contentType: string): BoundaryInfo | null {
  // Check if it's a multipart type
  if (!contentType.toLowerCase().startsWith('multipart/')) {
    return null
  }
  
  // Extract boundary using regex to handle quoted values and various formats
  // Examples:
  //   multipart/mixed; boundary=frame
  //   multipart/mixed; boundary="frame"
  //   multipart/mixed; charset=utf-8; boundary=frame
  const match = contentType.match(/boundary=["']?([^"';\s]+)["']?/i)
  if (!match) {
    return null
  }
  
  const boundaryStr = match[1]
  return {
    boundary: encoder.encode('--' + boundaryStr + '\r\n'),
    closingBoundary: encoder.encode('--' + boundaryStr + '--'),
  }
}

/**
 * Creates a multipart stream.
 * @param contentType A Content-Type header.
 * @param body The body of a HTTP response.
 * @returns a stream of {headers: Headers, body: Uint8Array} objects.
 */
export default function multipartStream(
  contentType: string,
  body: ReadableStream<Uint8Array>,
): ReadableStream<MultipartPart> {
  const reader = body.getReader()
  return new ReadableStream<MultipartPart>({
    async start(controller) {
      const boundaryInfo = getBoundary(contentType)
      if (boundaryInfo === null) {
        controller.error(
          new Error('Invalid content type for multipart stream: ' + contentType),
        )
        return
      }
      const { boundary, closingBoundary } = boundaryInfo

      let pos = 0
      let buf: Uint8Array = new Uint8Array()
      let state = STATE_BOUNDARY
      let headers: Headers | null = null
      let contentLength: number | null = null
      let closed = false

      /**
       * Consumes all complete data in buf or raises an Error.
       * May leave incomplete data at buf.slice(pos).
       * Returns true if stream should end.
       */
      function processBuf(): boolean {
        if (closed) return true
        while (true) {
          switch (state) {
            case STATE_BOUNDARY:
              // Read blank lines (if any) then boundary.
              while (
                buf.length >= pos + blankLine.length &&
                compareArrays(buf.slice(pos, pos + blankLine.length), blankLine)
              ) {
                pos += blankLine.length
              }

              // Check for closing boundary first (--boundary--)
              if (buf.length >= pos + closingBoundary.length) {
                if (compareArrays(buf.slice(pos, pos + closingBoundary.length), closingBoundary)) {
                  // Closing boundary found, stream is complete
                  closed = true
                  controller.close()
                  return true
                }
              }

              // Check that it starts with a normal boundary.
              if (buf.length < pos + boundary.length) {
                return false
              }

              if (!compareArrays(buf.slice(pos, pos + boundary.length), boundary)) {
                throw new Error('bad part boundary')
              }
              pos += boundary.length
              state = STATE_HEADERS
              headers = new Headers()
              break

            case STATE_HEADERS: {
              const cr = buf.indexOf('\r'.charCodeAt(0), pos)
              if (cr === -1 || buf.length === cr + 1) {
                return false
              }
              if (buf[cr + 1] !== '\n'.charCodeAt(0)) {
                throw new Error('bad part header line (CR without NL)')
              }
              const line = decoder.decode(buf.slice(pos, cr))
              pos = cr + 2
              if (line === '') {
                const rawContentLength = headers?.get('Content-Length')
                if (rawContentLength == null) {
                  throw new Error('missing/invalid part Content-Length')
                }
                contentLength = parseInt(rawContentLength, 10)
                if (isNaN(contentLength)) {
                  throw new Error('missing/invalid part Content-Length')
                }
                state = STATE_BODY
                break
              }
              const colon = line.indexOf(':')
              const name = line.substring(0, colon)
              if (colon === line.length || line[colon + 1] !== ' ') {
                throw new Error('bad part header line (no ": ")')
              }
              const value = line.substring(colon + 2)
              headers?.append(name, value)
              break
            }

            case STATE_BODY: {
              if (contentLength === null) {
                throw new Error('content length not set')
              }
              if (buf.length < pos + contentLength) {
                return false
              }
              const partBody = buf.slice(pos, pos + contentLength)
              pos += contentLength
              controller.enqueue({
                headers: headers!,
                body: partBody,
              })
              headers = null
              contentLength = null
              state = STATE_BOUNDARY
              break
            }
          }
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        const buffered = buf.length - pos
        if (done) {
          // Stream ended - already closed by processBuf?
          if (closed) {
            return
          }
          // Stream ended - check remaining buffer
          if (buffered > 0) {
            // Try to process remaining data (might be closing boundary)
            const remaining = buf.slice(pos)
            // Skip trailing whitespace/newlines
            let i = 0
            while (i < remaining.length && (remaining[i] === 0x0d || remaining[i] === 0x0a || remaining[i] === 0x20)) {
              i++
            }
            // Check for closing boundary in remaining data
            if (i < remaining.length) {
              const rest = remaining.slice(i)
              if (rest.length >= closingBoundary.length && 
                  compareArrays(rest.slice(0, closingBoundary.length), closingBoundary)) {
                // Valid closing boundary
                closed = true
                controller.close()
                return
              }
              // If we're mid-part, that's an error
              if (state !== STATE_BOUNDARY) {
                throw Error('multipart stream ended mid-part')
              }
            }
          }
          closed = true
          controller.close()
          return
        }

        // Update buf.slice(pos) to include the new data from value.
        if (buffered === 0) {
          buf = new Uint8Array(value)
        } else {
          const newLen = buffered + value.length
          const newBuf = new Uint8Array(newLen)
          newBuf.set(buf.slice(pos), 0)
          newBuf.set(value, buffered)
          buf = newBuf
        }
        pos = 0

        if (processBuf()) {
          return // Stream was closed
        }
      }
    },
    cancel(reason) {
      return reader.cancel(reason)
    },
  })
}
