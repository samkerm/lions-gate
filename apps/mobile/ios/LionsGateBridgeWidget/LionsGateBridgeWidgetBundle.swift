//
//  LionsGateBridgeWidgetBundle.swift
//  LionsGateBridgeWidget
//
//  Created by Sam Kheirandish on 2026-03-22.
//

import WidgetKit
import SwiftUI

@main
struct LionsGateBridgeWidgetBundle: WidgetBundle {
    var body: some Widget {
        LionsGateBridgeWidget()
        LionsGateBridgeWidgetControl()
        LionsGateBridgeWidgetLiveActivity()
    }
}
