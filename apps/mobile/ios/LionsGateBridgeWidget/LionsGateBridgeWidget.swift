//
//  LionsGateBridgeWidget.swift
//  LionsGateBridgeWidget
//

import SwiftUI
import WidgetKit

/// Formats ATIS `Last Update` (e.g. `2026/03/22, 16:57:21`) or ISO `fetchedAt` as friendly local time.
private enum AtisLastUpdatedFormat {
  /// Widget `kind` string — bump when you need iOS to treat the widget as new (avoids stale .appex UI).
  static let widgetKind = "BridgeStatusMediumV5"

  static func lastUpdatedLine(lastUpdated: String?, fetchedAt: String?) -> String? {
    if let s = displayString(fromRaw: lastUpdated) {
      return "Last updated: \(s)"
    }
    if let s = displayString(fromIsoFetchedAt: fetchedAt) {
      return "Last updated: \(s)"
    }
    if let lu = lastUpdated?.trimmingCharacters(in: .whitespacesAndNewlines), !lu.isEmpty {
      return "Last updated: \(lu)"
    }
    return nil
  }

  private static func displayString(fromRaw raw: String?) -> String? {
    guard let raw = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
      return nil
    }
    guard let date = parseDate(raw) else {
      return nil
    }
    return formatLocal(date)
  }

  private static func displayString(fromIsoFetchedAt raw: String?) -> String? {
    guard let raw = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
      return nil
    }
    guard let date = parseIso8601(raw) else {
      return nil
    }
    return formatLocal(date)
  }

  private static func formatLocal(_ date: Date) -> String {
    let cal = Calendar.current
    let time = DateFormatter()
    time.locale = Locale(identifier: "en_US_POSIX")
    time.timeZone = TimeZone.current
    time.dateFormat = "h:mm a"
    let timeStr = time.string(from: date)
    if cal.isDateInToday(date) {
      return "Today · \(timeStr)"
    }
    if cal.isDateInYesterday(date) {
      return "Yesterday · \(timeStr)"
    }
    let day = DateFormatter()
    day.locale = Locale(identifier: "en_US_POSIX")
    day.timeZone = TimeZone.current
    day.dateFormat = "MMM d"
    return "\(day.string(from: date)) · \(timeStr)"
  }

  private static func parseDate(_ s: String) -> Date? {
    let trimmed = s.trimmingCharacters(in: .whitespacesAndNewlines)
    let formats = [
      "yyyy/MM/dd, HH:mm:ss",
      "yyyy-MM-dd, HH:mm:ss",
      "yyyy/MM/dd HH:mm:ss",
      "yyyy/MM/dd,HH:mm:ss",
    ]
    let df = DateFormatter()
    df.locale = Locale(identifier: "en_US_POSIX")
    df.timeZone = TimeZone.current
    for f in formats {
      df.dateFormat = f
      if let d = df.date(from: trimmed) {
        return d
      }
    }
    return nil
  }

  private static func parseIso8601(_ s: String) -> Date? {
    let iso = ISO8601DateFormatter()
    iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let d = iso.date(from: s) {
      return d
    }
    iso.formatOptions = [.withInternetDateTime]
    return iso.date(from: s)
  }
}

enum WidgetPayloadStore {
  static let appGroupId = "group.com.samkerm.lionsgatebridge"
  static let fileName = "bridge-widget-payload.json"

  struct Payload: Codable {
    let schemaVersion: Int
    let lastUpdated: String?
    let fetchedAt: String?
    let perspectiveLabel: String
    let travelDirectionLabel: String
    let middleSlot: String
    let middleGreenHex: String?
    let rightGreenHex: String?
    let middleSpeedLine: String?
    let rightSpeedLine: String?
    let delayMinutes: Int?
    let delayBanner: String?
    let delayTrend: String?
    let previousDelayMinutes: Int?
    let bridgeQueueHint: String?
  }

  static func load() -> Payload? {
    guard let base = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId) else {
      return nil
    }
    let url = base.appendingPathComponent(fileName)
    guard let data = try? Data(contentsOf: url) else { return nil }
    return try? JSONDecoder().decode(Payload.self, from: data)
  }
}

struct BridgeEntry: TimelineEntry {
  let date: Date
  let lastUpdated: String?
  let fetchedAt: String?
  let perspectiveLabel: String
  let travelDirectionLabel: String
  let middleSlot: String
  let middleGreenHex: String?
  let rightGreenHex: String?
  let middleSpeedLine: String?
  let rightSpeedLine: String?
  let delayMinutes: Int?
  let delayBanner: String
  let delayTrend: String
  let previousDelayMinutes: Int?
  let bridgeQueueHint: String?
}

struct BridgeTimelineProvider: TimelineProvider {
  func placeholder(in context: Context) -> BridgeEntry {
    BridgeEntry(
      date: Date(),
      lastUpdated: nil,
      fetchedAt: nil,
      perspectiveLabel: "Lions Gate Bridge",
      travelDirectionLabel: "—",
      middleSlot: "neutral",
      middleGreenHex: nil,
      rightGreenHex: nil,
      middleSpeedLine: "65 km/h",
      rightSpeedLine: "61 km/h",
      delayMinutes: 5,
      delayBanner: "yellow",
      delayTrend: "down",
      previousDelayMinutes: 10,
      bridgeQueueHint: nil
    )
  }

  func getSnapshot(in context: Context, completion: @escaping (BridgeEntry) -> Void) {
    completion(loadEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<BridgeEntry>) -> Void) {
    let entry = loadEntry()
    let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
    completion(Timeline(entries: [entry], policy: .after(next)))
  }

  private func loadEntry() -> BridgeEntry {
    let p = WidgetPayloadStore.load()
    return BridgeEntry(
      date: Date(),
      lastUpdated: p?.lastUpdated,
      fetchedAt: p?.fetchedAt,
      perspectiveLabel: p?.perspectiveLabel ?? "Lions Gate Bridge",
      travelDirectionLabel: p?.travelDirectionLabel ?? "—",
      middleSlot: p?.middleSlot ?? "neutral",
      middleGreenHex: p?.middleGreenHex,
      rightGreenHex: p?.rightGreenHex,
      middleSpeedLine: p?.middleSpeedLine,
      rightSpeedLine: p?.rightSpeedLine,
      delayMinutes: p?.delayMinutes,
      delayBanner: p?.delayBanner ?? "none",
      delayTrend: p?.delayTrend ?? "unknown",
      previousDelayMinutes: p?.previousDelayMinutes,
      bridgeQueueHint: p?.bridgeQueueHint
    )
  }
}

private extension Color {
  /// Parses `#RRGGBB` or `RRGGBB` from the JS payload.
  init?(hex: String) {
    var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if s.hasPrefix("#") {
      s.removeFirst()
    }
    guard s.count == 6, let v = UInt32(s, radix: 16) else {
      return nil
    }
    let r = Double((v >> 16) & 0xff) / 255
    let g = Double((v >> 8) & 0xff) / 255
    let b = Double(v & 0xff) / 255
    self.init(red: r, green: g, blue: b)
  }
}

private struct LaneCircle: View {
  let color: Color
  let showsX: Bool

  private static let diameter: CGFloat = 60

  var body: some View {
    ZStack {
      Circle()
        .fill(color)
        .frame(width: Self.diameter, height: Self.diameter)
      if showsX {
        Image(systemName: "xmark")
          .font(.system(size: 21, weight: .bold))
          .foregroundStyle(.white)
      } else {
        Image(systemName: "arrow.up")
          .font(.system(size: 25, weight: .bold))
          .foregroundStyle(.white)
      }
    }
  }
}

private struct LaneColumnWithSpeed: View {
  let color: Color
  let showsX: Bool
  let speedText: String?

  private let speedMuted = Color(white: 0.65)

  var body: some View {
    VStack(alignment: .center, spacing: 0) {
      LaneCircle(color: color, showsX: showsX)
      if let s = speedText?.trimmingCharacters(in: .whitespacesAndNewlines), !s.isEmpty {
        Text(s)
          .font(.system(size: 11, weight: .regular))
          .foregroundStyle(speedMuted)
          .lineLimit(1)
          .lineSpacing(0)
          .minimumScaleFactor(0.75)
          .frame(maxWidth: 72)
          .multilineTextAlignment(.center)
          .padding(.top, 2)
      }
    }
    .frame(width: 72, alignment: .top)
  }
}

private struct DelayBannerBlock: View {
  let delayMinutes: Int?
  let delayBanner: String
  let delayTrend: String
  let previousDelayMinutes: Int?
  let bridgeQueueHint: String?

  private var hasDelay: Bool {
    guard let m = delayMinutes else { return false }
    return m > 0
  }

  private var accent: Color {
    switch delayBanner {
    case "red":
      return Color(red: 0.96, green: 0.35, blue: 0.28)
    case "yellow":
      return Color(red: 0.98, green: 0.88, blue: 0.2)
    default:
      return Color(white: 0.55)
    }
  }

  private let captionMuted = Color(white: 0.65)
  /// Muted headline when there is no delay (stable layout, low visual weight).
  private let noDelayPrimary = Color(white: 0.5)
  /// Merge slower than bridge — possible queue forming (matches in-app hint).
  private let queueBuildingPrimary = Color(white: 0.92)
  /// Softer than red: delay trending up (not “alarm” weight on a small widget).
  private let buildingUpLine = Color(white: 0.82)
  /// Keeps the lane row aligned when the trend line is absent.
  private static let trendRowHeight: CGFloat = 11

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      Text("BRIDGE DELAY · ALL DIRECTIONS")
        .font(.system(size: 9, weight: .semibold))
        .foregroundStyle(captionMuted)
        .lineLimit(1)
        .lineSpacing(0)
        .minimumScaleFactor(0.85)
        .padding(.bottom, -1)

      if hasDelay, let m = delayMinutes {
        Text("\(m) MIN")
          .font(.system(size: 20, weight: .heavy, design: .rounded))
          .foregroundStyle(accent)
          .minimumScaleFactor(0.9)
          .lineLimit(1)
          .lineSpacing(0)
          .padding(.vertical, -4)
      } else if bridgeQueueHint == "possible_queue" {
        Text("Possible delay building up")
          .font(.system(size: 20, weight: .heavy, design: .rounded))
          .foregroundStyle(queueBuildingPrimary)
          .minimumScaleFactor(0.9)
          .lineLimit(1)
          .lineSpacing(0)
          .padding(.vertical, -4)
      } else {
        Text("No delays")
          .font(.system(size: 20, weight: .heavy, design: .rounded))
          .foregroundStyle(noDelayPrimary)
          .minimumScaleFactor(0.9)
          .lineLimit(1)
          .lineSpacing(0)
          .padding(.vertical, -4)
      }

      if hasDelay, delayTrend == "down", let prev = previousDelayMinutes {
        Text("↓ from \(prev) min")
          .font(.system(size: 9, weight: .regular))
          .lineSpacing(0)
          .foregroundStyle(Color(red: 0.55, green: 0.95, blue: 0.65))
          .padding(.top, -2)
      } else if hasDelay, delayTrend == "up" {
        Text(
          previousDelayMinutes.map { prev in
            "Possible delay building up · ↑ from \(prev) min"
          } ?? "Possible delay building up"
        )
        .font(.system(size: 9, weight: .regular))
        .lineSpacing(0)
        .foregroundStyle(buildingUpLine)
        .lineLimit(1)
        .minimumScaleFactor(0.72)
        .padding(.top, -2)
      } else {
        Color.clear
          .frame(height: Self.trendRowHeight)
          .padding(.top, -2)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

struct LionsGateBridgeWidgetEntryView: View {
  var entry: BridgeEntry

  private static let defaultMiddleGreen = Color(red: 0.11, green: 0.5, blue: 0.23)
  private static let defaultRightGreen = Color(red: 0.11, green: 0.5, blue: 0.23)

  private var middleColor: Color {
    switch entry.middleSlot {
    case "green":
      if let h = entry.middleGreenHex, let c = Color(hex: h) {
        return c
      }
      return Self.defaultMiddleGreen
    case "red":
      return Color(red: 0.71, green: 0.14, blue: 0.09)
    default:
      return Color(red: 0.42, green: 0.45, blue: 0.5)
    }
  }

  private var rightLaneColor: Color {
    if let h = entry.rightGreenHex, let c = Color(hex: h) {
      return c
    }
    return Self.defaultRightGreen
  }

  private let labelSecondary = Color(white: 0.72)

  var body: some View {
    VStack(alignment: .leading, spacing: 1) {
      DelayBannerBlock(
        delayMinutes: entry.delayMinutes,
        delayBanner: entry.delayBanner,
        delayTrend: entry.delayTrend,
        previousDelayMinutes: entry.previousDelayMinutes,
        bridgeQueueHint: entry.bridgeQueueHint
      )

      HStack(alignment: .top, spacing: 10) {
        LaneColumnWithSpeed(
          color: Color(red: 0.71, green: 0.14, blue: 0.09),
          showsX: true,
          speedText: nil
        )
        LaneColumnWithSpeed(
          color: middleColor,
          showsX: entry.middleSlot == "red",
          speedText: entry.middleSpeedLine
        )
        LaneColumnWithSpeed(
          color: rightLaneColor,
          showsX: false,
          speedText: entry.rightSpeedLine
        )
      }
      .frame(maxWidth: .infinity, alignment: .top)
      .padding(.top, -2)

      VStack(alignment: .leading, spacing: 0) {
        Text(entry.perspectiveLabel)
          .font(.system(size: 10, weight: .regular))
          .foregroundStyle(labelSecondary)
          .lineLimit(1)
          .lineSpacing(0)
          .minimumScaleFactor(0.85)
          .padding(.bottom, -3)

        if let line = AtisLastUpdatedFormat.lastUpdatedLine(
          lastUpdated: entry.lastUpdated,
          fetchedAt: entry.fetchedAt
        ) {
          Text(line)
            .font(.system(size: 9, weight: .regular))
            .foregroundStyle(labelSecondary)
            .lineLimit(1)
            .lineSpacing(0)
            .minimumScaleFactor(0.7)
        }
      }
    }
    .padding(.horizontal, 10)
    .padding(.top, 9)
    .padding(.bottom, 7)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}

struct LionsGateBridgeWidget: Widget {
  /// Bumped from `LionsGateBridgeWidget` so a clean install picks up new Swift UI (old home-screen tiles can cache forever).
  let kind: String = AtisLastUpdatedFormat.widgetKind

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: BridgeTimelineProvider()) { entry in
      LionsGateBridgeWidgetEntryView(entry: entry)
        .preferredColorScheme(.dark)
        .environment(\.colorScheme, .dark)
        .containerBackground(for: .widget) {
          Color.black
        }
    }
    .configurationDisplayName("Lions Gate Bridge")
    .description("Delay, lanes, and perspective.")
    .supportedFamilies([.systemMedium])
  }
}

#Preview(as: .systemMedium) {
  LionsGateBridgeWidget()
} timeline: {
  BridgeEntry(
    date: .now,
    lastUpdated: "2026/03/22, 16:46:21",
    fetchedAt: "2026-03-22T23:30:00.000Z",
    perspectiveLabel: "Downtown Vancouver",
    travelDirectionLabel: "NB",
    middleSlot: "green",
    middleGreenHex: "#22c55e",
    rightGreenHex: "#bbf7d0",
    middleSpeedLine: "58 km/h",
    rightSpeedLine: "72 km/h",
    delayMinutes: 5,
    delayBanner: "yellow",
    delayTrend: "down",
    previousDelayMinutes: 10,
    bridgeQueueHint: nil
  )
}
