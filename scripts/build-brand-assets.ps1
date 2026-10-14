<#
.SYNOPSIS
Builds TuturAI brand/PWA icon assets from the masters in docs/brand/.

Masters (never served to browsers):
    docs/brand/Brand-all-guidelines.png   full brand sheet
    docs/brand/logo-icon.png              full-bleed mascot app icon on #2F6DF5

Generated (served):
    apps/web/public/brand/*.png           in-app artwork (logo, mascot, wordmark)
    apps/web/public/icons/*.png           PWA icons referenced by the manifest
    apps/web/app/icon.png                 favicon (Next.js file convention)
    apps/web/app/apple-icon.png           Apple touch icon
    apps/web/app/opengraph-image.png      social card
    apps/web/app/twitter-image.png        social card (same art)

    pwsh -File scripts/build-brand-assets.ps1

Source crop regions are pixel boxes inside the guidelines sheet. Each region is
auto-trimmed to its ink bounding box, so small source drift is tolerated; if a
region comes back EMPTY it moved and must be re-measured.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$guidelinesPath = Join-Path $root 'docs/brand/Brand-all-guidelines.png'
$logoIconPath = Join-Path $root 'docs/brand/logo-icon.png'
foreach ($required in @($guidelinesPath, $logoIconPath)) {
    if (-not (Test-Path -LiteralPath $required)) {
        throw "Brand source not found at $required."
    }
}

$brandDir = Join-Path $root 'apps/web/public/brand'
$iconDir = Join-Path $root 'apps/web/public/icons'
$appDir = Join-Path $root 'apps/web/app'
New-Item -ItemType Directory -Force -Path $brandDir, $iconDir | Out-Null

$white = [System.Drawing.Color]::FromArgb(255, 255, 255)

function Save-Resized {
    param($Src, $Dest, $W, $H, $Background = $null)
    $bmp = New-Object System.Drawing.Bitmap $W, $H
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = 'HighQualityBicubic'
    $g.PixelOffsetMode = 'HighQuality'
    if ($Background) { $g.Clear($Background) }
    $k = [Math]::Min($W / [double]$Src.Width, $H / [double]$Src.Height)
    $dw = [int]($Src.Width * $k)
    $dh = [int]($Src.Height * $k)
    $g.DrawImage($Src, [int](($W - $dw) / 2), [int](($H - $dh) / 2), $dw, $dh)
    $g.Dispose()
    $bmp.Save($Dest, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host ("  {0,-34} {1}x{2}" -f (Split-Path $Dest -Leaf), $W, $H)
}

# ------------------------------------------------------- logo-icon app icon
# The master is a full-bleed square, so it is resized rather than cropped.
Write-Host 'Building app icons from logo-icon.png...'
$appIconMaster = New-Object System.Drawing.Bitmap $logoIconPath
Save-Resized $appIconMaster (Join-Path $brandDir 'logo-icon.png') 512 512
Save-Resized $appIconMaster (Join-Path $iconDir 'icon-192.png') 192 192
Save-Resized $appIconMaster (Join-Path $iconDir 'icon-512.png') 512 512
# Maskable: the master is already full-bleed, so it is used at native scale.
# The mascot sits inside the 80% safe zone and survives every platform mask.
Save-Resized $appIconMaster (Join-Path $iconDir 'icon-maskable-512.png') 512 512
# iOS icons cannot have transparent padding; the full-bleed master needs none.
Save-Resized $appIconMaster (Join-Path $iconDir 'apple-touch-icon.png') 180 180
Save-Resized $appIconMaster (Join-Path $appDir 'icon.png') 256 256
Save-Resized $appIconMaster (Join-Path $appDir 'apple-icon.png') 180 180
$appIconMaster.Dispose()

# ------------------------------------------- artwork cropped from guidelines
$guidelines = New-Object System.Drawing.Bitmap $guidelinesPath

function Get-InkBounds {
    param([int]$X0, [int]$Y0, [int]$X1, [int]$Y1)
    $minX = [int]::MaxValue; $minY = [int]::MaxValue; $maxX = -1; $maxY = -1
    for ($y = $Y0; $y -lt $Y1; $y++) {
        for ($x = $X0; $x -lt $X1; $x++) {
            $p = $guidelines.GetPixel($x, $y)
            $isBlue = ($p.B -gt 140) -and (($p.B - $p.R) -gt 60)
            $isDark = ($p.R -lt 200) -and ($p.G -lt 200) -and ($p.B -lt 200)
            if ($isBlue -or $isDark) {
                if ($x -lt $minX) { $minX = $x }
                if ($x -gt $maxX) { $maxX = $x }
                if ($y -lt $minY) { $minY = $y }
                if ($y -gt $maxY) { $maxY = $y }
            }
        }
    }
    if ($maxX -lt 0) { return $null }
    return [pscustomobject]@{ X = $minX; Y = $minY; W = ($maxX - $minX + 1); H = ($maxY - $minY + 1) }
}

Write-Host 'Cropping artwork from guidelines sheet...'
# Regions are content boxes that exclude each panel's caption text above the art.
$mascot = Get-InkBounds 620 190 860 400
$simplified = Get-InkBounds 900 205 1080 365
$wordmark = Get-InkBounds 1080 200 1448 360
foreach ($r in @(
        @{ n = 'mascot'; v = $mascot },
        @{ n = 'simplified'; v = $simplified },
        @{ n = 'wordmark'; v = $wordmark })) {
    if (-not $r.v) { throw "Crop region for '$($r.n)' came back EMPTY - re-measure the guidelines sheet." }
}

function Save-Crop {
    param($Region, $Dest)
    $clone = New-Object System.Drawing.Bitmap $Region.W, $Region.H
    $g = [System.Drawing.Graphics]::FromImage($clone)
    $g.InterpolationMode = 'HighQualityBicubic'
    $g.PixelOffsetMode = 'HighQuality'
    $g.DrawImage(
        $guidelines,
        (New-Object System.Drawing.Rectangle 0, 0, $Region.W, $Region.H),
        $Region.X, $Region.Y, $Region.W, $Region.H,
        [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    $clone.Save($Dest, [System.Drawing.Imaging.ImageFormat]::Png)
    $clone.Dispose()
    Write-Host ("  {0,-34} {1}x{2}" -f (Split-Path $Dest -Leaf), $Region.W, $Region.H)
}

Save-Crop $mascot (Join-Path $brandDir 'mascot.png')
Save-Crop $simplified (Join-Path $brandDir 'simplified-logo.png')
Save-Crop $wordmark (Join-Path $brandDir 'wordmark.png')

# ------------------------------------------------- Open Graph / Twitter card
Write-Host 'Building Open Graph / Twitter cards...'
# wordmark.png is the guidelines' "Mascot + wordmark" horizontal lockup, so the
# card is that lockup scaled to fit the brand canvas. The wordmark crop keeps
# the panel's white background, so the canvas is white too - a gray canvas shows
# a visible rectangle seam around the lockup.
# JPEG q92 is used because it measures 85% smaller than PNG for this artwork
# (330KB -> 49KB) and every social platform accepts it.
$ogW = 1200; $ogH = 630
$cardCanvas = [System.Drawing.Color]::FromArgb(255, 255, 255)
$w = New-Object System.Drawing.Bitmap (Join-Path $brandDir 'wordmark.png')
$bmp = New-Object System.Drawing.Bitmap $ogW, $ogH
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = 'HighQualityBicubic'
$g.PixelOffsetMode = 'HighQuality'
$g.Clear($cardCanvas)
$k = [Math]::Min(($ogW * 0.82) / [double]$w.Width, ($ogH * 0.64) / [double]$w.Height)
$g.DrawImage($w, [int](($ogW - $w.Width * $k) / 2), [int](($ogH - $w.Height * $k) / 2), [int]($w.Width * $k), [int]($w.Height * $k))
$g.Dispose()
$jpegEncoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.FormatID -eq [System.Drawing.Imaging.ImageFormat]::Jpeg.Guid }
$qualityParams = New-Object System.Drawing.Imaging.EncoderParameters 1
$qualityParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 92L
$bmp.Save((Join-Path $appDir 'opengraph-image.jpg'), $jpegEncoder, $qualityParams)
$bmp.Save((Join-Path $appDir 'twitter-image.jpg'), $jpegEncoder, $qualityParams)
Write-Host "  opengraph-image.jpg              ${ogW}x${ogH}"
Write-Host "  twitter-image.jpg                ${ogW}x${ogH}"
$bmp.Dispose(); $w.Dispose()

$guidelines.Dispose()
Write-Host 'Brand assets rebuilt.'
