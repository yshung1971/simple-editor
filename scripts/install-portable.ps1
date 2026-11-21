param(
    [Parameter(Mandatory = $true)]
    [string]$SourceExe,

    [string]$Destination = "C:\PortableApps\SimpleEditor"
)

$ErrorActionPreference = "Stop"
$resolvedSource = (Resolve-Path -LiteralPath $SourceExe).Path
$destinationExe = Join-Path $Destination "simple-editor.exe"

New-Item -ItemType Directory -Path $Destination -Force | Out-Null
Copy-Item -LiteralPath $resolvedSource -Destination $destinationExe -Force

$applicationKey = "HKCU:\Software\Classes\Applications\simple-editor.exe"
$progIdKey = "HKCU:\Software\Classes\SimpleEditor.Text"
$command = "`"$destinationExe`" `"%1`""

New-Item -Path "$applicationKey\DefaultIcon" -Force | Out-Null
New-Item -Path "$applicationKey\shell\open\command" -Force | Out-Null
New-Item -Path "$applicationKey\SupportedTypes" -Force | Out-Null
Set-Item -LiteralPath $applicationKey -Value "Simple Editor"
Set-ItemProperty -LiteralPath $applicationKey -Name "FriendlyAppName" -Value "Simple Editor"
Set-ItemProperty -LiteralPath "$applicationKey\DefaultIcon" -Name "(default)" -Value "$destinationExe,0"
Set-ItemProperty -LiteralPath "$applicationKey\shell\open\command" -Name "(default)" -Value $command
foreach ($extension in @(".txt", ".md", ".markdown", ".log")) {
    New-ItemProperty -LiteralPath "$applicationKey\SupportedTypes" -Name $extension -Value "" -PropertyType String -Force | Out-Null
}

New-Item -Path "$progIdKey\DefaultIcon" -Force | Out-Null
New-Item -Path "$progIdKey\shell\open\command" -Force | Out-Null
Set-Item -LiteralPath $progIdKey -Value "Simple Editor Document"
Set-ItemProperty -LiteralPath $progIdKey -Name "FriendlyTypeName" -Value "Text Document"
Set-ItemProperty -LiteralPath "$progIdKey\DefaultIcon" -Name "(default)" -Value "$destinationExe,0"
Set-ItemProperty -LiteralPath "$progIdKey\shell\open\command" -Name "(default)" -Value $command

foreach ($extension in @(".txt", ".md", ".markdown", ".log")) {
    $extensionKey = "HKCU:\Software\Classes\$extension"
    New-Item -Path "$extensionKey\OpenWithProgids" -Force | Out-Null
    New-Item -Path "$extensionKey\OpenWithList\simple-editor.exe" -Force | Out-Null
    New-ItemProperty -LiteralPath "$extensionKey\OpenWithProgids" -Name "SimpleEditor.Text" -Value "" -PropertyType String -Force | Out-Null
    Set-ItemProperty -LiteralPath "$extensionKey\OpenWithList\simple-editor.exe" -Name "(default)" -Value "Simple Editor"
}

$shell = New-Object -ComObject WScript.Shell
foreach ($shortcutPath in @(
    (Join-Path ([Environment]::GetFolderPath("Desktop")) "Simple Editor.lnk"),
    (Join-Path ([Environment]::GetFolderPath("Programs")) "Simple Editor.lnk")
)) {
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $destinationExe
    $shortcut.WorkingDirectory = $Destination
    $shortcut.IconLocation = "$destinationExe,0"
    $shortcut.Save()
}

Write-Output "Installed: $destinationExe"
Write-Output "Registered in HKCU Open With for .txt, .md, .markdown, and .log"

