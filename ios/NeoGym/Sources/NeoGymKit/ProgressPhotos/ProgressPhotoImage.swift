import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

public enum ProgressPhotoImage {
    public static let jpegLimit = 5 * 1024 * 1024
    public static let maxEdge = 2_560
    // Match the web Storage transform; decode the returned crop at full size.
    static let thumbnailWidth = 480
    static let thumbnailHeight = 600
    static let inputLimit = 25 * 1024 * 1024
    static let formats = [UTType.jpeg, .png, .heic, .heif]
    static let displayFormats = [UTType.jpeg, .png, .webP]

    /// Consume the provider-owned temporary file while its representation is valid.
    /// Never retain its URL, make another disk copy, or request a DataRepresentation.
    public static func prepare(file: URL) throws -> Data {
        let info = try file.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey])
        guard info.isRegularFile == true, let size = info.fileSize, size > 0 else {
            throw ProgressPhotoError.invalidImage
        }
        guard size <= inputLimit else { throw ProgressPhotoError.inputTooLarge }
        let handle = try FileHandle(forReadingFrom: file)
        defer { try? handle.close() }
        var input = Data()
        while input.count <= inputLimit {
            try Task.checkCancellation()
            guard let chunk = try handle.read(upToCount: min(64 * 1024, inputLimit + 1 - input.count)),
                  !chunk.isEmpty else { break }
            input.append(chunk)
        }
        guard input.count <= inputLimit else { throw ProgressPhotoError.inputTooLarge }
        let pixels = try canonicalPixels(decode(input, formats: formats, maxEdge: maxEdge))
        for quality in [0.90, 0.76, 0.60, 0.44] {
            try Task.checkCancellation()
            let output = NSMutableData()
            guard let encoder = CGImageDestinationCreateWithData(output, UTType.jpeg.identifier as CFString, 1, nil) else {
                break
            }
            // Copy pixels only; never pass the source or any source property dictionary to the encoder.
            CGImageDestinationAddImage(encoder, pixels, [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary)
            if CGImageDestinationFinalize(encoder), output.length > 0, output.length <= jpegLimit {
                try Task.checkCancellation()
                return output as Data
            }
        }
        throw ProgressPhotoError.encodingFailed
    }

    /// Convert to a standard colour space so a source-supplied ICC profile does
    /// not ride along with the pixels. Flatten transparent PNGs on white.
    private static func canonicalPixels(_ source: CGImage) throws -> CGImage {
        guard let space = CGColorSpace(name: CGColorSpace.sRGB),
              let context = CGContext(data: nil, width: source.width, height: source.height,
                                      bitsPerComponent: 8, bytesPerRow: 0, space: space,
                                      bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else {
            throw ProgressPhotoError.encodingFailed
        }
        let bounds = CGRect(x: 0, y: 0, width: source.width, height: source.height)
        context.setFillColor(CGColor(gray: 1, alpha: 1))
        context.fill(bounds)
        context.draw(source, in: bounds)
        guard let pixels = context.makeImage() else { throw ProgressPhotoError.encodingFailed }
        return pixels
    }

    public static func display(_ data: Data, thumbnail: Bool) throws -> CGImage {
        guard data.count <= jpegLimit else { throw ProgressPhotoError.inputTooLarge }
        return try decode(data, formats: displayFormats, maxEdge: thumbnail ? max(thumbnailWidth, thumbnailHeight) : maxEdge)
    }

    private static func decode(_ data: Data, formats: [UTType], maxEdge: Int) throws -> CGImage {
        try Task.checkCancellation()
        guard !data.isEmpty,
              let source = CGImageSourceCreateWithData(data as CFData, [kCGImageSourceShouldCache: false] as CFDictionary),
              let type = CGImageSourceGetType(source), formats.contains(where: { $0.identifier == type as String }),
              CGImageSourceGetCount(source) == 1,
              let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let width = properties[kCGImagePropertyPixelWidth] as? Int,
              let height = properties[kCGImagePropertyPixelHeight] as? Int, width > 0, height > 0 else {
            throw ProgressPhotoError.invalidImage
        }
        guard width <= 12_000, height <= 12_000, width * height <= 40_000_000 else {
            throw ProgressPhotoError.dimensionsTooLarge
        }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: maxEdge
        ]
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary),
              max(image.width, image.height) <= maxEdge,
              CGImageSourceGetStatusAtIndex(source, 0) == .statusComplete else {
            throw ProgressPhotoError.invalidImage
        }
        try Task.checkCancellation()
        return image
    }
}
