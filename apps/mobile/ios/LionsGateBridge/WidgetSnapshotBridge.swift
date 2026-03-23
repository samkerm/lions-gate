import Foundation
import WidgetKit

@objc(WidgetSnapshotBridge)
class WidgetSnapshotBridge: NSObject {
  static let appGroupId = "group.com.saumkh.lionsgatebridge"
  static let fileName = "bridge-widget-payload.json"

  @objc
  func writeSnapshot(_ json: String) {
    guard let base = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Self.appGroupId) else {
      return
    }
    let url = base.appendingPathComponent(Self.fileName)
    do {
      try json.write(to: url, atomically: true, encoding: .utf8)
    } catch {
      return
    }
    DispatchQueue.main.async {
      WidgetCenter.shared.reloadTimelines(ofKind: "BridgeStatusMediumV5")
      WidgetCenter.shared.reloadAllTimelines()
    }
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }
}
