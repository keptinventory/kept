// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "KeptNativeStore",
    platforms: [.iOS(.v15), .macOS(.v13)],
    products: [.library(name: "KeptNativeStore", targets: ["KeptNativeStore"])],
    targets: [
        .target(name: "KeptNativeStore"),
        .testTarget(name: "KeptNativeStoreTests", dependencies: ["KeptNativeStore"])
    ]
)
