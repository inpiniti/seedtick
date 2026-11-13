# Generates the 1200x630 Open Graph card used by the landing pages and studio.
# Run from the reportist-video folder: powershell -ExecutionPolicy Bypass -File scripts/generate-og-image.ps1

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$outPath = Join-Path $root "public\og-penguincut.png"
$logoPath = Join-Path $root "public\icon-512x512.png"

$width = 1200
$height = 630

$bmp = New-Object System.Drawing.Bitmap($width, $height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

# Background
$bg = [System.Drawing.Color]::FromArgb(6, 8, 12)
$g.Clear($bg)

# Amber glow (radial gradient)
$glowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$glowPath.AddEllipse(760, -230, 720, 620)
$glowBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($glowPath)
$glowBrush.CenterColor = [System.Drawing.Color]::FromArgb(46, 246, 196, 83)
$glowBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 6, 8, 12))
$g.FillPath($glowBrush, $glowPath)
$glowBrush.Dispose()
$glowPath.Dispose()

# Subtle grid
$gridPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(13, 255, 255, 255), 1)
for ($x = 0; $x -le $width; $x += 60) {
    $g.DrawLine($gridPen, $x, 0, $x, $height)
}
for ($y = 0; $y -le $height; $y += 60) {
    $g.DrawLine($gridPen, 0, $y, $width, $y)
}
$gridPen.Dispose()

# Logo on a light app-icon tile so the dark penguin stays readable.
function New-RoundedRectPath($x, $y, $w, $h, $r) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($x, $y, $r * 2, $r * 2, 180, 90)
    $path.AddArc($x + $w - $r * 2, $y, $r * 2, $r * 2, 270, 90)
    $path.AddArc($x + $w - $r * 2, $y + $h - $r * 2, $r * 2, $r * 2, 0, 90)
    $path.AddArc($x, $y + $h - $r * 2, $r * 2, $r * 2, 90, 90)
    $path.CloseFigure()
    return $path
}

$logoTile = New-RoundedRectPath 88 76 88 88 22
$logoTileBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(244, 247, 251))
$g.FillPath($logoTileBrush, $logoTile)
$logoTilePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(70, 246, 196, 83), 1)
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
$brandBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(244, 247, 251))
$g.DrawString("PenguinCut", $brandFont, $brandBrush, 198, 86)

$kickerFont = New-Object System.Drawing.Font("Segoe UI", 15, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$accentBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(246, 196, 83))
$g.DrawString("AI VIDEO HIGHLIGHT EDITOR", $kickerFont, $accentBrush, 201, 143)

# Amber rule
$ruleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(246, 196, 83))
$g.FillRectangle($ruleBrush, 88, 278, 4, 154)

# Headline
$headlineFont = New-Object System.Drawing.Font("Segoe UI", 60, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$headlineBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(244, 247, 251))
$g.DrawString("Turn hours of footage", $headlineFont, $headlineBrush, 124, 266)
$g.DrawString("into one cinematic highlight.", $headlineFont, $headlineBrush, 124, 336)

# Subhead
$subFont = New-Object System.Drawing.Font("Segoe UI", 23, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(154, 166, 182))
$g.DrawString("AI finds the climax. You get the finished 16:9 film.", $subFont, $subBrush, 124, 424)

# Timeline card
$timelineBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(13, 18, 24))
$timelinePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(32, 255, 255, 255), 1)
$timelineRect = New-Object System.Drawing.Rectangle(124, 486, 440, 62)
$g.FillRectangle($timelineBrush, $timelineRect)
$g.DrawRectangle($timelinePen, $timelineRect)

$clipBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(36, 255, 255, 255))
$clips = @(
    @{ X = 142; W = 62 },
    @{ X = 210; W = 84 },
    @{ X = 300; W = 102 },
    @{ X = 408; W = 60 },
    @{ X = 474; W = 72 }
)
foreach ($clip in $clips) {
    $rect = New-Object System.Drawing.Rectangle($clip.X, 505, $clip.W, 24)
    $g.FillRectangle($clipBrush, $rect)
}
$clipBrush.Dispose()

$hotBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(246, 196, 83))
$hotRect = New-Object System.Drawing.Rectangle(300, 505, 102, 24)
$g.FillRectangle($hotBrush, $hotRect)
$hotBrush.Dispose()

$playPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(244, 247, 251), 2)
$g.DrawLine($playPen, 356, 496, 356, 536)
$playPen.Dispose()

# URL
$urlFont = New-Object System.Drawing.Font("Consolas", 18, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$urlBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(116, 128, 145))
$g.DrawString("penguincut.com", $urlFont, $urlBrush, 124, 562)

# 16:9 badge
$badgeFont = New-Object System.Drawing.Font("Consolas", 15, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$badgeRect = New-Object System.Drawing.Rectangle(1004, 520, 108, 34)
$g.FillRectangle((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(18, 246, 196, 83))), $badgeRect)
$g.DrawRectangle((New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(70, 246, 196, 83), 1)), $badgeRect)
$g.DrawString("16:9", $badgeFont, $accentBrush, 1031, 528)

# Cleanup
$brandFont.Dispose()
$brandBrush.Dispose()
$kickerFont.Dispose()
$accentBrush.Dispose()
$ruleBrush.Dispose()
$headlineFont.Dispose()
$headlineBrush.Dispose()
$subFont.Dispose()
$subBrush.Dispose()
$timelineBrush.Dispose()
$timelinePen.Dispose()
$urlFont.Dispose()
$urlBrush.Dispose()
$badgeFont.Dispose()

$g.Dispose()
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

Write-Output "Wrote $outPath"
