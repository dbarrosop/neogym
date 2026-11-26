export const INPUT_BYTE_LIMIT = 25 * 1024 * 1024;
export const INPUT_PIXEL_LIMIT = 40_000_000;
export const OUTPUT_EDGE = 2560;
const INPUT_EDGE_LIMIT = 12_000;

export type Dimensions = { width: number; height: number };

export function checkDimensions({ width, height }: Dimensions) {
  if (!(width > 0 && height > 0)) {
    throw new Error("The image has invalid dimensions.");
  }
  if (Math.max(width, height) > INPUT_EDGE_LIMIT || width * height > INPUT_PIXEL_LIMIT) {
    throw new Error("Choose an image no larger than 40 megapixels or 12,000 px on either side.");
  }
}

export function jpegDimensions(view: DataView): Dimensions {
  let offset = 2;
  while (offset < view.byteLength) {
    if (view.getUint8(offset++) !== 0xff) {
      break;
    }
    while (view.getUint8(offset) === 0xff) {
      offset++;
    }
    const marker = view.getUint8(offset++);
    // The frame header must precede any scan. Disallow zero/late dimensions.
    if (marker === 0xda || marker === 0xd9) {
      break;
    }
    const size = view.getUint16(offset);
    if (size < 2 || offset + size > view.byteLength) {
      break;
    }
    if ([0xc0, 0xc1, 0xc2].includes(marker) && size >= 8) {
      return { height: view.getUint16(offset + 3), width: view.getUint16(offset + 5) };
    }
    offset += size;
  }
  throw new Error("Choose a readable, still JPEG image.");
}

function pngDimensions(view: DataView): Dimensions {
  if (view.getUint32(4) !== 0x0d0a1a0a || tag(view, 12) !== "IHDR" || view.getUint32(8) !== 13) {
    throw new Error("Choose a readable PNG image.");
  }
  for (let offset = 8; offset + 12 <= view.byteLength; ) {
    const size = view.getUint32(offset);
    const type = tag(view, offset + 4);
    if (type === "acTL") {
      throw new Error("Choose a still photo, not an animated PNG.");
    }
    if (type === "IDAT" || size > view.byteLength - offset - 12) {
      break;
    }
    offset += size + 12;
  }
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function tag(view: DataView, offset: number) {
  return String.fromCharCode(...new Uint8Array(view.buffer, view.byteOffset + offset, 4));
}

type Box = { type: string; start: number; end: number };

function* boxes(view: DataView, start: number, end: number): Generator<Box> {
  let cursor = start;
  let count = 0;
  while (cursor + 8 <= end && count++ < 4096) {
    let size = view.getUint32(cursor);
    let header = 8;
    if (size === 1) {
      if (cursor + 16 > end || view.getUint32(cursor + 8) !== 0) {
        break;
      }
      size = view.getUint32(cursor + 12);
      header = 16;
    } else if (size === 0) {
      size = end - cursor;
    }
    if (size < header || cursor + size > end) {
      break;
    }
    yield { type: tag(view, cursor + 4), start: cursor + header, end: cursor + size };
    cursor += size;
  }
  if (cursor !== end) {
    throw new Error("The HEIC image is incomplete.");
  }
}

function heicProperties(view: DataView, meta: Box) {
  for (const child of boxes(view, meta.start + 4, meta.end)) {
    if (child.type === "iprp") {
      return [...boxes(view, child.start, child.end)];
    }
  }
  return [];
}

function heicDimensions(view: DataView) {
  let still = false;
  let meta: Box | undefined;
  for (const box of boxes(view, 0, view.byteLength)) {
    if (box.type === "moov") {
      throw new Error("Choose a still photo, not an image sequence.");
    }
    if (box.type === "ftyp") {
      for (let offset = box.start; offset + 4 <= box.end; offset += 4) {
        if (offset === box.start + 4) {
          continue; // Minor version, not a compatible brand.
        }
        const brand = tag(view, offset);
        still ||= ["heic", "heix", "heim", "heis"].includes(brand);
      }
    }
    if (box.type === "meta") {
      meta = box;
    }
  }
  if (still && meta) {
    checkHeicSpatialExtents(view, meta);
    return;
  }
  throw new Error("Choose a JPEG, PNG, or supported HEIC still photo.");
}

function checkHeicSpatialExtents(view: DataView, meta: Box) {
  const properties = heicProperties(view, meta);
  const container = properties.find(({ type }) => type === "ipco");
  if (!container) {
    throw new Error("The HEIC image is missing its dimensions.");
  }
  const extents = new Set<number>();
  let propertyIndex = 0;
  for (const box of boxes(view, container.start, container.end)) {
    propertyIndex++;
    if (box.type === "ispe" && box.end - box.start === 12) {
      checkDimensions({
        width: view.getUint32(box.start + 4),
        height: view.getUint32(box.start + 8),
      });
      extents.add(propertyIndex);
    }
  }
  const primary = [...boxes(view, meta.start + 4, meta.end)].find(({ type }) => type === "pitm");
  if (primary && primary.end - primary.start >= 6) {
    const version = view.getUint8(primary.start);
    if (version === 0 || (version === 1 && primary.end - primary.start >= 8)) {
      const id =
        version === 0 ? view.getUint16(primary.start + 4) : view.getUint32(primary.start + 4);
      if (
        properties.some((box) => box.type === "ipma" && hasPrimaryExtent(view, box, id, extents))
      ) {
        return;
      }
    }
  }
  throw new Error("The HEIC image is missing its primary dimensions.");
}

function hasPrimaryExtent(view: DataView, box: Box, primary: number, extents: Set<number>) {
  if (box.end - box.start < 8) {
    return false;
  }
  const version = view.getUint8(box.start);
  const itemSize = version === 0 ? 2 : 4;
  const wide = Boolean(view.getUint8(box.start + 3) & 1);
  const count = view.getUint32(box.start + 4);
  let offset = box.start + 8;
  for (let item = 0; item < count && offset + itemSize < box.end; item++) {
    const id = itemSize === 2 ? view.getUint16(offset) : view.getUint32(offset);
    offset += itemSize;
    const associations = view.getUint8(offset++);
    for (let n = 0; n < associations && offset + Number(wide) < box.end; n++) {
      const index = wide ? view.getUint16(offset) & 0x7fff : view.getUint8(offset) & 0x7f;
      offset += wide ? 2 : 1;
      if (id === primary && extents.has(index)) {
        return true;
      }
    }
  }
  return false;
}

export function inspectImage(buffer: ArrayBuffer): "image/jpeg" | "image/png" | "image/heic" {
  const view = new DataView(buffer);
  if (view.byteLength >= 4 && view.getUint16(0) === 0xffd8) {
    checkDimensions(jpegDimensions(view));
    return "image/jpeg";
  }
  if (view.byteLength >= 24 && view.getUint32(0) === 0x89504e47) {
    checkDimensions(pngDimensions(view));
    return "image/png";
  }
  if (view.byteLength >= 16 && tag(view, 4) === "ftyp") {
    heicDimensions(view);
    return "image/heic";
  }
  throw new Error("Choose a JPEG, PNG, or supported HEIC still photo.");
}
