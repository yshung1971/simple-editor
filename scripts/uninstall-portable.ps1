param(
    [string]$Destination = "C:\PortableApps\SimpleEditor"
)

$ErrorActionPreference = "Stop"

foreach ($key in @(
    "HKCU:\Software\Classes\Applications\simple-editor.exe",
    "HKCU:\Software\Classes\SimpleEditor.Text"
)) {
    if (Test-Path $key) {
        Remove-Item -LiteralPath $key -Recurse
    }
}

foreach ($extension in @(".txt", ".md", ".markdown", ".log")) {
    $extensionKey = "HKCU:\Software\Classes\$extension"
    $progIdKey = "$extensionKey\OpenWithProgids"
    $applicationKey = "$extensionKey\OpenWithList\simple-editor.exe"
    if (Test-Path $progIdKey) {
        Remove-ItemProperty -LiteralPath $progIdKey -Name "SimpleEditor.Text" -ErrorAction SilentlyContinue
    }
    if (Test-Path $applicationKey) {
        Remove-Item -LiteralPath $applicationKey -Recurse
    }
}

foreach ($shortcutPath in @(
    (Join-Path ([Environment]::GetFolderPath("Desktop")) "Simple Editor.lnk"),
    (Join-Path ([Environment]::GetFolderPath("Programs")) "Simple Editor.lnk")
)) {
    if (Test-Path $shortcutPath) {
        Remove-Item -LiteralPath $shortcutPath
    }
}

Write-Output "Open With registration and shortcuts removed."
Write-Output "Portable files remain at: $Destination"

