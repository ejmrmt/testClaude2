// Package.swift
// このファイルはSwiftPM用です。Xcodeプロジェクトの場合は、
// File > Add Package Dependenciesで以下のパッケージを追加してください。

import PackageDescription

let package = Package(
    name: "GeminiAIApp",
    platforms: [
        .iOS(.v15)
    ],
    dependencies: [
        .package(url: "https://github.com/firebase/firebase-ios-sdk.git", from: "10.20.0")
    ],
    targets: [
        .target(
            name: "GeminiAIApp",
            dependencies: [
                .product(name: "FirebaseCore", package: "firebase-ios-sdk"),
                .product(name: "FirebaseVertexAI", package: "firebase-ios-sdk")
            ]
        )
    ]
)

/*
Xcodeプロジェクトでの依存関係追加手順:

1. Xcodeでプロジェクトを開く
2. File > Add Package Dependencies...
3. 以下のURLを入力して追加:
   https://github.com/firebase/firebase-ios-sdk.git

4. 以下のライブラリを選択:
   - FirebaseCore
   - FirebaseVertexAI

5. GoogleService-Info.plist をプロジェクトに追加
   (Firebase Consoleからダウンロード)
*/