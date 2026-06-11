# iPhone Support Notes

pura can support iPhone, but it should be scoped differently from Android. Android gives us ADB screenrecord and input injection. iOS does not expose equivalent general-purpose screen streaming and touch injection for arbitrary apps without developer tooling.

## Recommended Product Scope

Phase 1: iPhone inventory and screenshots

- Detect paired USB iPhone devices from the local agent.
- Show iPhone cards in the same device grid.
- Capture screenshots and store them under the device record, like Android screenshots.
- Reuse existing copy/download/device-management UI.

This can be implemented with libimobiledevice tools such as `idevice_id`, `ideviceinfo`, and `idevicescreenshot`. The `idevicescreenshot` tool requires the device to be paired/trusted and the screenshot service to be available.

Phase 2: iPhone view-only preview

- Start with periodic screenshot refresh, not video.
- Use a clear badge such as `iOS preview` instead of `live` if it is screenshot-based.
- Keep cursor, box selection, drawing, and screenshot management working on top of the preview.

True live iOS screen mirroring is possible only through more platform-specific approaches, such as capturing a QuickTime/AirPlay/macOS window, or building a native macOS companion with ScreenCaptureKit. That is a larger product direction than the current Node-only agent.

Phase 3: iPhone control, optional

- Use WebDriverAgent/XCTest only for automation-style actions.
- Support tap, swipe, text, app launch, and screenshots when WDA is installed and trusted.
- Treat it as a separate `automation` capability, not the same as Android raw input.

WebDriverAgent can automate real iOS devices through XCTest, but setup is heavier: Xcode, signing, trust, WDA runner install, and occasional device-specific instability. It is suitable for QA automation labs, less suitable as a frictionless product-design mirror.

## Proposed Device Model

Add a `platform` field:

```ts
type DevicePlatform = "android" | "ios";
```

Add optional capabilities:

```ts
type DeviceCapabilities = {
  liveVideo: boolean;
  screenshot: boolean;
  tap: boolean;
  swipe: boolean;
  text: boolean;
  automation?: "adb" | "wda";
};
```

Android defaults:

- `liveVideo: true`
- `screenshot: true`
- `tap/swipe/text: true`
- `automation: "adb"`

iPhone phase 1 defaults:

- `liveVideo: false`
- `screenshot: true`
- `tap/swipe/text: false`

iPhone WDA defaults:

- `liveVideo: false`
- `screenshot: true`
- `tap/swipe/text: true`
- `automation: "wda"`

## CLI Shape

```bash
pura-cli connect <hub> --name "Liu" --background
pura-cli connect iphone --name "Liu iPhone" --owner "Liu" --note "iOS 18"
```

For WDA:

```bash
pura-cli connect iphone --wda http://127.0.0.1:8100 --name "Liu iPhone"
```

## Implementation Notes

- Keep Android and iPhone capture/control implementations behind separate adapters.
- Do not make iOS a branch inside Android ADB modules.
- Store screenshots by hub-visible `deviceSerial` so device management can show all screenshots for the selected iPhone.
- Use copy/download paths already added for Android screenshots.
- If live iOS preview is screenshot polling, label it as preview, not live.

## References

- Apple Xcode command-line tools include device-related tools such as `devicectl`: https://developer.apple.com/documentation/xcode/xcode-command-line-tool-reference
- libimobiledevice `idevicescreenshot` documents paired/trusted device screenshot capture and screenshot service requirements: https://cgit.libimobiledevice.org/libimobiledevice.git/tree/docs/idevicescreenshot.1?id=79f05179a4ac8b5d9a19d47993370f8508032319
- WebDriverAgent describes iOS device automation via XCTest, including launch, tap, scroll, and screen checks: https://github.com/facebookarchive/WebDriverAgent
