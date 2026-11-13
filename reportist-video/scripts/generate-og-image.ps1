# Generates the 1200x630 Open Graph card used by the landing pages and studio.
# Run from the reportist-video folder: powershell -ExecutionPolicy Bypass -File scripts/generate-og-image.ps1

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$outPath = Join-Path $root "public\og-penguincut.png"
$logoPath = Join-Path $root "public\icon-512x512.png"

$width = 1200
$height = 630

$script:navy = [System.Drawing.Color]::FromArgb(15, 23, 42)
$script:slate = [System.Drawing.Color]::FromArgb(100, 116, 139)
$script:faint = [System.Drawing.Color]::FromArgb(148, 163, 184)
$script:border = [System.Drawing.Color]::FromArgb(226, 232, 240)
$script:mutedBg = [System.Drawing.Color]::FromArgb(241, 245, 249)
$script:emerald = [System.Drawing.Color]::FromArgb(5, 150, 105)
$script:emeraldDark = [System.Drawing.Color]::FromArgb(4, 120, 87)
$script:emeraldSoft = [System.Drawing.Color]::FromArgb(236, 253, 245)
$script:emeraldLine = [System.Drawing.Color]::FromArgb(167, 243, 208)

$bmp = New-Object System.Drawing.Bitmap($width, $height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

# Background: app page background with a faint grid.
$g.Clear([System.Drawing.Color]::FromArgb(248, 249, 250))
$gridPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(10, 15, 23, 42), 1)
for ($x = 0; $x -le $width; $x += 60) {
    $g.DrawLine($gridPen, $x, 0, $x, $height)
}
for ($y = 0; $y -le $height; $y += 60) {
    $g.DrawLine($gridPen, 0, $y, $width, $y)
}
$gridPen.Dispose()

function New-RoundedRectPath($x, $y, $w, $h, $r) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($x, $y, $r * 2, $r * 2, 180, 90)
    $path.AddArc($x + $w - $r * 2, $y, $r * 2, $r * 2, 270, 90)
    $path.AddArc($x + $w - $r * 2, $y + $h - $r * 2, $r * 2, $r * 2, 0, 90)
    $path.AddArc($x, $y + $h - $r * 2, $r * 2, $r * 2, 90, 90)
    $path.CloseFigure()
    return $path
}

# Logo tile: white with a hairline border, like the app's cards.
$logoTile = New-RoundedRectPath 88 76 88 88 22
$logoTileBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$g.FillPath($logoTileBrush, $logoTile)
$logoTilePen = New-Object System.Drawing.Pen($script:border, 1.5)
$g.DrawPath($logoTilePen, $logoTile)

if (Test-Path $logoPath) {
    $logo = [System.Drawing.Image]::FromFile($logoPath)
    $g.DrawImage($logo, 100, 88, 64, 64)
    $logo.Dispose()
}

$logoTileBrush.Dispose()
$logoTilePen.Dispose()
$logoTile.Dispose()

# Brand
$brandFont = New-Object System.Drawing.Font("Segoe UI", 38, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$brandBrush = New-Object System.Drawing.SolidBrush($script:navy)
$g.DrawString("PenguinCut", $brandFont, $brandBrush, 198, 86)

$kickerFont = New-Object System.Drawing.Font("Segoe UI", 15, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$kickerBrush = New-Object System.Drawing.SolidBrush($script:emerald)
$g.DrawString("AI VIDEO HIGHLIGHT EDITOR", $kickerFont, $kickerBrush, 201, 143)

# Navy rule
$ruleBrush = New-Object System.Drawing.SolidBrush($script:navy)
$g.FillRectangle($ruleBrush, 88, 278, 4, 154)

# Headline
$headlineFont = New-Object System.Drawing.Font("Segoe UI", 60, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$headlineBrush = New-Object System.Drawing.SolidBrush($script:navy)
$g.DrawString("Turn hours of footage", $headlineFont, $headlineBrush, 124, 266)
$g.DrawString("into one cinematic highlight.", $headlineFont, $headlineBrush, 124, 336)

# Subhead
$subFont = New-Object System.Drawing.Font("Segoe UI", 23, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$subBrush = New-Object System.Drawing.SolidBrush($script:slate)
$g.DrawString("AI finds the climax. You get the finished 16:9 film.", $subFont, $subBrush, 124, 424)

# Timeline card: white card with border, like the app.
$timelineRect = New-Object System.Drawing.Rectangle(124, 486, 440, 62)
$timelinePath = New-RoundedRectPath 124 486 440 62 10
$timelineBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$g.FillPath($timelineBrush, $timelinePath)
$timelinePen = New-Object System.Drawing.Pen($script:border, 1.5)
$g.DrawPath($timelinePen, $timelinePath)

$clipBrush = New-Object System.Drawing.SolidBrush($script:mutedBg)
$clips = @(
    @{ X = 142; W = 62 },
    @{ X = 210; W = 84 },
    @{ X = 300; W = 102 },
    @{ X = 408; W = 60 },
    @{ X = 474; W = 72 }
)
foreach ($clip in $clips) {
    $g.FillRectangle($clipBrush, $clip.X, 505, $clip.W, 24)
}
$clipBrush.Dispose()

$hotBrush = New-Object System.Drawing.SolidBrush($script:emerald)
$g.FillRectangle($hotBrush, 300, 505, 102, 24)
$hotBrush.Dispose()

$playPen = New-Object System.Drawing.Pen($script:navy, 2)
$g.DrawLine($playPen, 356, 496, 356, 536)
$playPen.Dispose()

# URL
$urlFont = New-Object System.Drawing.Font("Consolas", 18, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$urlBrush = New-Object System.Drawing.SolidBrush($script:faint)
$g.DrawString("penguincut.com", $urlFont, $urlBrush, 124, 562)

# 16:9 badge: emerald soft, like the app's accent chips.
$badgeFont = New-Object System.Drawing.Font("Consolas", 15, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$badgePath = New-RoundedRectPath 1004 520 108 34 8
$badgeBrush = New-Object System.Drawing.SolidBrush($script:emeraldSoft)
$g.FillPath($badgeBrush, $badgePath)
$badgePen = New-Object System.Drawing.Pen($script:emeraldLine, 1.5)
$g.DrawPath($badgePen, $badgePath)
$badgeTextBrush = New-Object System.Drawing.SolidBrush($script:emeraldDark)
$g.DrawString("16:9", $badgeFont, $badgeTextBrush, 1031, 528)
$badgeBrush.Dispose()
$badgePen.Dispose()
$badgeTextBrush.Dispose()
$badgePath.Dispose()

# Cleanup
$brandFont.Dispose()
$brandBrush.Dispose()
$kickerFont.Dispose()
$kickerBrush.Dispose()
$ruleBrush.Dispose()
$headlineFont.Dispose()
$headlineBrush.Dispose()
$subFont.Dispose()
$subBrush.Dispose()
$timelineBrush.Dispose()
$timelinePen.Dispose()
$timelinePath.Dispose()
$urlFont.Dispose()
$urlBrush.Dispose()
$badgeFont.Dispose()

$g.Dispose()
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

Write-Output "Wrote $outPath"
