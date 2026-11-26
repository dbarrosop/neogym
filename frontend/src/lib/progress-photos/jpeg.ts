function isScanData(marker: number) {
  return marker === 0 || (marker >= 0xd0 && marker <= 0xd7);
}

function isMetadata(marker: number) {
  return (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe;
}

/** Remove application/comment blocks (including encoder-added EXIF) and trailing data. */
export function stripJpegMetadata(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  if (view.getUint16(0) !== 0xffd8) {
    throw new Error("The encoder didn't produce a JPEG.");
  }
  const kept: Uint8Array<ArrayBuffer>[] = [];
  let keepFrom = 0;
  let offset = 2;
  let scanning = false;
  while (offset < bytes.length) {
    const markerStart = scanning ? bytes.indexOf(0xff, offset) : offset;
    if (markerStart < 0 || bytes[markerStart] !== 0xff) {
      break;
    }
    offset = markerStart + 1;
    while (bytes[offset] === 0xff) {
      offset++;
    }
    const marker = bytes[offset++];
    if (marker === undefined) {
      break;
    }
    if (scanning && isScanData(marker)) {
      continue; // Stuffed data or a restart marker inside an entropy-coded scan.
    }
    if (marker === 0xd9) {
      kept.push(bytes.subarray(keepFrom, offset));
      return new Blob(kept, { type: "image/jpeg" });
    }
    if (offset + 2 > bytes.length) {
      break;
    }
    const length = view.getUint16(offset);
    if (length < 2 || offset + length > bytes.length) {
      break;
    }
    offset += length;
    if (isMetadata(marker)) {
      kept.push(bytes.subarray(keepFrom, markerStart));
      keepFrom = offset;
    }
    scanning = marker === 0xda;
  }
  throw new Error("The encoder produced an incomplete JPEG.");
}
