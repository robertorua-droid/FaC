# aggiorna_manuali.ps1
# Questo script legge i file .md nella cartella DOCUMENTAZIONE e genera
# il file js/features/navigation/docs-content.js in modo che l'app
# funzioni anche senza un server web locale.

$docsDir = Join-Path $PSScriptRoot "DOCUMENTAZIONE"
$outputFile = Join-Path $PSScriptRoot "js/features/navigation/docs-content.js"

if (-not (Test-Path $docsDir)) {
    Write-Host "ERRORE: Cartella DOCUMENTAZIONE non trovata!" -ForegroundColor Red
    exit
}

# Inizio del file JavaScript
$jsContent = "(function () {`n  window.AppDocumentationContent = {`n"

$files = Get-ChildItem -Path $docsDir -Filter "*.md"
$count = 0

foreach ($file in $files) {
    $key = $file.BaseName
    # Leggiamo il file come UTF8
    $text = Get-Content -Path $file.FullName -Raw -Encoding UTF8
    
    # Escapiamo backtick e segni di dollaro
    $escaped = $text -replace '`', '\`' -replace '\$', '\$'
    
    # Usiamo l'operatore di formattazione per inserire i backtick (char 96)
    $line = '    "{0}": {1}{2}{1},' -f $key, ([char]96), $escaped
    
    $jsContent += $line
    
    if ($count -lt ($files.Count - 1)) {
        $jsContent += "`n`n"
    }
    $count++
}

$jsContent += "`n  };`n})();"

# Assicurati che la cartella di output esista
$outputDir = Split-Path $outputFile
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

# Scrittura del file con codifica UTF8 senza BOM
$Utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($outputFile, $jsContent, $Utf8NoBom)

Write-Host "Successo! Aggiornato $outputFile con $($files.Count) file manuale." -ForegroundColor Green
Write-Host "Ora ricarica index.html nel browser per vedere le modifiche."
