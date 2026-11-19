// Renders the static graphics for the Cavaro App Store preview at 886x1920.
// Usage: swift render_gfx.swift <out_dir> <logo_png>
import AppKit

let W = 886, H = 1920
// Footage window (app capture is 1320x2868 -> scaled to 644x1400)
let FX = 121, FY = 452, FW = 644, FH = 1400, RADIUS: CGFloat = 86

let outDir = CommandLine.arguments[1]
let logoPath = CommandLine.arguments[2]

func hex(_ s: String, _ a: CGFloat = 1) -> NSColor {
    var v: UInt64 = 0
    Scanner(string: s.replacingOccurrences(of: "#", with: "")).scanHexInt64(&v)
    return NSColor(srgbRed: CGFloat((v >> 16) & 0xff) / 255, green: CGFloat((v >> 8) & 0xff) / 255,
                   blue: CGFloat(v & 0xff) / 255, alpha: a)
}

let bgColor = hex("#0D0B09"), glow = hex("#3A2918"), gold = hex("#C8A45D"),
    goldMuted = hex("#8F7440"), cream = hex("#F5EFE7"), muted = hex("#A79C8E")

func canvas(_ w: Int, _ h: Int, _ draw: (CGContext) -> Void) -> NSBitmapImageRep {
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: w, pixelsHigh: h, bitsPerSample: 8,
                               samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                               colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    let ctx = NSGraphicsContext(bitmapImageRep: rep)!
    NSGraphicsContext.current = ctx
    // flip so y grows downward like video coordinates
    ctx.cgContext.translateBy(x: 0, y: CGFloat(h))
    ctx.cgContext.scaleBy(x: 1, y: -1)
    draw(ctx.cgContext)
    NSGraphicsContext.restoreGraphicsState()
    return rep
}

func save(_ rep: NSBitmapImageRep, _ name: String) {
    try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "\(outDir)/\(name)"))
    print("wrote \(name)")
}

func drawBackground(_ c: CGContext) {
    c.setFillColor(bgColor.cgColor)
    c.fill(CGRect(x: 0, y: 0, width: W, height: H))
    let space = CGColorSpaceCreateDeviceRGB()
    let grad = CGGradient(colorsSpace: space, colors: [glow.withAlphaComponent(0.9).cgColor,
                                                        glow.withAlphaComponent(0).cgColor] as CFArray,
                          locations: [0, 1])!
    c.drawRadialGradient(grad, startCenter: CGPoint(x: W / 2, y: 260), startRadius: 0,
                         endCenter: CGPoint(x: W / 2, y: 260), endRadius: 760, options: [])
    let grad2 = CGGradient(colorsSpace: space, colors: [glow.withAlphaComponent(0.45).cgColor,
                                                         glow.withAlphaComponent(0).cgColor] as CFArray,
                           locations: [0, 1])!
    c.drawRadialGradient(grad2, startCenter: CGPoint(x: W / 2, y: H + 100), startRadius: 0,
                         endCenter: CGPoint(x: W / 2, y: H + 100), endRadius: 700, options: [])
}

func serif(_ size: CGFloat, _ weight: NSFont.Weight = .medium) -> NSFont {
    let base = NSFont.systemFont(ofSize: size, weight: weight)
    if let d = base.fontDescriptor.withDesign(.serif) { return NSFont(descriptor: d, size: size)! }
    return base
}

// Draws centered text; shrinks font until each line fits maxWidth.
func drawCentered(_ text: String, font: NSFont, color: NSColor, centerY: CGFloat, kern: CGFloat = 0,
                  lineHeight: CGFloat? = nil, maxWidth: CGFloat = 780) {
    var f = font
    func attrs(_ f: NSFont) -> [NSAttributedString.Key: Any] {
        let p = NSMutableParagraphStyle()
        p.alignment = .center
        if let lh = lineHeight { p.minimumLineHeight = lh * f.pointSize / font.pointSize; p.maximumLineHeight = p.minimumLineHeight }
        return [.font: f, .foregroundColor: color, .kern: kern, .paragraphStyle: p]
    }
    while f.pointSize > 20 {
        let widest = text.split(separator: "\n").map {
            NSAttributedString(string: String($0), attributes: attrs(f)).size().width }.max() ?? 0
        if widest <= maxWidth { break }
        f = NSFont(descriptor: f.fontDescriptor, size: f.pointSize - 2)!
    }
    let s = NSAttributedString(string: text, attributes: attrs(f))
    let size = s.boundingRect(with: NSSize(width: CGFloat(W), height: 2000), options: [.usesLineFragmentOrigin]).size
    let rect = CGRect(x: 0, y: centerY - size.height / 2, width: CGFloat(W), height: size.height)
    // NSAttributedString draws in a flipped-aware way when context is flipped
    NSGraphicsContext.current!.cgContext.saveGState()
    let flipped = NSGraphicsContext(cgContext: NSGraphicsContext.current!.cgContext, flipped: true)
    NSGraphicsContext.current = flipped
    s.draw(with: rect, options: [.usesLineFragmentOrigin])
    NSGraphicsContext.current!.cgContext.restoreGState()
}

// 1. Background
save(canvas(W, H) { drawBackground($0) }, "bg.png")

// 2. Rounded-corner mask for the footage (white = visible)
save(canvas(FW, FH) { c in
    c.setFillColor(NSColor.black.cgColor); c.fill(CGRect(x: 0, y: 0, width: FW, height: FH))
    c.setFillColor(NSColor.white.cgColor)
    c.addPath(CGPath(roundedRect: CGRect(x: 0, y: 0, width: FW, height: FH), cornerWidth: RADIUS,
                     cornerHeight: RADIUS, transform: nil)); c.fillPath()
}, "mask.png")

// 3. Frame: soft shadow + gold hairline around the footage window (transparent elsewhere)
save(canvas(W, H) { c in
    let r = CGRect(x: FX, y: FY, width: FW, height: FH).insetBy(dx: -1.5, dy: -1.5)
    let path = CGPath(roundedRect: r, cornerWidth: RADIUS + 1.5, cornerHeight: RADIUS + 1.5, transform: nil)
    c.setStrokeColor(goldMuted.withAlphaComponent(0.75).cgColor)
    c.setLineWidth(3)
    c.addPath(path); c.strokePath()
}, "frame.png")

// 4. Captions
let captions: [(String, String)] = [
    ("YOUR CIGAR COMPANION", "Your humidor,\nrefined."),
    ("INVENTORY", "Every cigar.\nEvery humidor."),
    ("CIGAR DETAILS", "Know exactly\nwhat you own."),
    ("PALATE MATCH", "Will you love it?\nKnow before you light."),
    ("SMOKE JOURNAL", "Remember\nevery smoke."),
    ("MY TASTE", "An app that learns\nyour palate."),
    ("MY COLLECTION", "Your lifetime\ncigar journey."),
]
for (i, cap) in captions.enumerated() {
    save(canvas(W, H) { c in
        drawCentered(cap.0, font: NSFont.systemFont(ofSize: 25, weight: .semibold), color: gold,
                     centerY: 168, kern: 5)
        // thin gold rule under the kicker
        c.setFillColor(goldMuted.withAlphaComponent(0.8).cgColor)
        c.fill(CGRect(x: W / 2 - 28, y: 196, width: 56, height: 2))
        drawCentered(cap.1, font: serif(66), color: cream, centerY: 310, lineHeight: 80)
    }, "cap_\(i + 1).png")
}

// 5. End card
let logo = NSImage(contentsOfFile: logoPath)!
save(canvas(W, H) { c in
    drawBackground(c)
    let lw: CGFloat = 640, lh = lw * logo.size.height / logo.size.width
    let lr = CGRect(x: (CGFloat(W) - lw) / 2, y: 700 - lh / 2, width: lw, height: lh)
    let flipped = NSGraphicsContext(cgContext: c, flipped: true)
    NSGraphicsContext.current = flipped
    logo.draw(in: lr, from: .zero, operation: .sourceOver, fraction: 1, respectFlipped: true, hints: nil)
    drawCentered("Your personal\ncigar companion.", font: serif(58), color: cream, centerY: 1110, lineHeight: 72)
    c.setFillColor(goldMuted.withAlphaComponent(0.8).cgColor)
    c.fill(CGRect(x: W / 2 - 28, y: 1235, width: 56, height: 2))
    drawCentered("TRACK  ·  TASTE  ·  DISCOVER", font: NSFont.systemFont(ofSize: 24, weight: .semibold),
                 color: gold, centerY: 1290, kern: 4)
}, "end.png")
