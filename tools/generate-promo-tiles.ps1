Add-Type -AssemblyName System.Drawing

$srcDrop = Join-Path $PSScriptRoot "sources\source-ss1-chat.png"
$logoPath = (Resolve-Path "$PSScriptRoot\..\icons\icon128.png").Path
$outputDir = "$PSScriptRoot\..\store"

if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

# Carregar Google Sans oficial
$pfc = New-Object System.Drawing.Text.PrivateFontCollection
$pfc.AddFontFile((Resolve-Path "$PSScriptRoot\fonts\GoogleSans-Regular.ttf").Path)
$pfc.AddFontFile((Resolve-Path "$PSScriptRoot\fonts\GoogleSans-Bold.ttf").Path)
$pfc.AddFontFile((Resolve-Path "$PSScriptRoot\fonts\GoogleSans-Medium.ttf").Path)
$googleSans = $pfc.Families | Where-Object { $_.Name -eq "Google Sans" } | Select-Object -First 1
if (-not $googleSans) { $googleSans = $pfc.Families[0] }
$global:googleSans = $googleSans

$jpgEncoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.FormatDescription -eq "JPEG" }
$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 96L)

# ==============================================================================
# 1. BLOCO PROMOCIONAL PEQUENO (440 x 280)
# ==============================================================================
$w1 = 440
$h1 = 280
$bmp1 = New-Object System.Drawing.Bitmap($w1, $h1, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$g1 = [System.Drawing.Graphics]::FromImage($bmp1)
$global:g1 = $g1
$g1.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g1.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g1.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g1.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

# Fundo gradiente
$bgRect1 = New-Object System.Drawing.Rectangle(0, 0, $w1, $h1)
$bgBrush1 = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $bgRect1,
    [System.Drawing.Color]::FromArgb(13, 20, 38),
    [System.Drawing.Color]::FromArgb(6, 10, 18),
    [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
)
$g1.FillRectangle($bgBrush1, $bgRect1)
$bgBrush1.Dispose()

# Ambient glow
$glow1 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(18, 65, 50))
$g1.FillEllipse($glow1, -60, -60, 280, 200)
$glow1.Dispose()

$glow2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(15, 45, 80))
$g1.FillEllipse($glow2, 220, 100, 280, 220)
$glow2.Dispose()

# Logo oficial
$logoImg1 = [System.Drawing.Bitmap]::FromFile($logoPath)
$g1.DrawImage($logoImg1, 22, 22, 64, 64)
$logoImg1.Dispose()

# Eyebrow tag com medicao dinamica
$tagFont1 = New-Object System.Drawing.Font($googleSans, 7.5, [System.Drawing.FontStyle]::Bold)
$tagText1 = "GOOGLE GEMINI + WHATSAPP"
$tagSize1 = $g1.MeasureString($tagText1, $tagFont1)
$tagBoxW1 = [int]($tagSize1.Width + 18)
$tagBoxH1 = 20
$tagBoxX1 = 96
$tagBoxY1 = 22

$tagBg1 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(16, 50, 40))
$tagPen1 = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(16, 185, 129), 1)
$tagTxt1 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(52, 211, 153))

$g1.FillRectangle($tagBg1, $tagBoxX1, $tagBoxY1, $tagBoxW1, $tagBoxH1)
$g1.DrawRectangle($tagPen1, $tagBoxX1, $tagBoxY1, $tagBoxW1, $tagBoxH1)
$g1.DrawString($tagText1, $tagFont1, $tagTxt1, ($tagBoxX1 + 9), ($tagBoxY1 + 3))
$tagBg1.Dispose(); $tagPen1.Dispose(); $tagTxt1.Dispose(); $tagFont1.Dispose()

# Titulo
$titleFont1 = New-Object System.Drawing.Font($googleSans, 15, [System.Drawing.FontStyle]::Bold)
$titleBrush1 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$g1.DrawString("VoiceScribe", $titleFont1, $titleBrush1, 96, 42)
$g1.DrawString("for WhatsApp™", $titleFont1, $titleBrush1, 96, 64)
$titleFont1.Dispose(); $titleBrush1.Dispose()

# Subtitulo em 2 linhas
$subFont1 = New-Object System.Drawing.Font($googleSans, 9.5, [System.Drawing.FontStyle]::Regular)
$subBrush1 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(156, 163, 175))
$g1.DrawString("Transcreva mensagens de voz em texto no WhatsApp", $subFont1, $subBrush1, 22, 100)
$g1.DrawString("com inteligência artificial rápida e gratuita.", $subFont1, $subBrush1, 22, 118)
$subFont1.Dispose(); $subBrush1.Dispose()

# 4 Badges de beneficios compactos
function DrawSmallPill {
    param($x, $y, $w, $text, $accentColor)
    $bg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(17, 24, 39))
    $pen = New-Object System.Drawing.Pen($accentColor, 1)
    $txt = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(226, 232, 240))
    $f = New-Object System.Drawing.Font($global:googleSans, 8, [System.Drawing.FontStyle]::Bold)
    
    $global:g1.FillRectangle($bg, $x, $y, $w, 28)
    $global:g1.DrawRectangle($pen, $x, $y, $w, 28)
    $global:g1.DrawString($text, $f, $txt, ($x + 8), ($y + 6))
    
    $bg.Dispose(); $pen.Dispose(); $txt.Dispose(); $f.Dispose()
}

DrawSmallPill -x 22 -y 160 -w 190 -text "✓ Transcrição Instantânea" -accentColor ([System.Drawing.Color]::FromArgb(16, 185, 129))
DrawSmallPill -x 222 -y 160 -w 195 -text "✓ 100% Privado (Sem Servidor)" -accentColor ([System.Drawing.Color]::FromArgb(6, 182, 212))

DrawSmallPill -x 22 -y 200 -w 190 -text "✓ Pool com Rotação de Cotas" -accentColor ([System.Drawing.Color]::FromArgb(59, 130, 246))
DrawSmallPill -x 222 -y 200 -w 195 -text "✓ Grátis e Código Aberto" -accentColor ([System.Drawing.Color]::FromArgb(168, 85, 247))

$jpg1 = Join-Path $outputDir "promo-small-440x280.jpg"
$bmp1.Save($jpg1, $jpgEncoder, $encoderParams)
$g1.Dispose()
$bmp1.Dispose()

Write-Host "Bloco promocional pequeno gerado exclusivamente em JPEG: $jpg1"

# ==============================================================================
# 2. BLOCO PROMOCIONAL DE LETREIRO (1400 x 560)
# ==============================================================================
$w2 = 1400
$h2 = 560
$bmp2 = New-Object System.Drawing.Bitmap($w2, $h2, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$g2 = [System.Drawing.Graphics]::FromImage($bmp2)
$global:g2 = $g2
$g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g2.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

# Fundo gradiente widescreen
$bgRect2 = New-Object System.Drawing.Rectangle(0, 0, $w2, $h2)
$bgBrush2 = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $bgRect2,
    [System.Drawing.Color]::FromArgb(11, 17, 32),
    [System.Drawing.Color]::FromArgb(5, 8, 15),
    [System.Drawing.Drawing2D.LinearGradientMode]::Horizontal
)
$g2.FillRectangle($bgBrush2, $bgRect2)
$bgBrush2.Dispose()

# Ambient glow
$glowL = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(16, 55, 42))
$g2.FillEllipse($glowL, -100, -80, 500, 450)
$glowL.Dispose()

$glowR = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(12, 40, 75))
$g2.FillEllipse($glowR, 700, -60, 600, 450)
$glowR.Dispose()

# Lado Esquerdo - Branding
$logoImg2 = [System.Drawing.Bitmap]::FromFile($logoPath)
$g2.DrawImage($logoImg2, 55, 48, 76, 76)
$logoImg2.Dispose()

# Eyebrow Pill com medicao dinamica
$tagFont2 = New-Object System.Drawing.Font($googleSans, 9, [System.Drawing.FontStyle]::Bold)
$tagText2 = "GOOGLE GEMINI + WHATSAPP WEB"
$tagSize2 = $g2.MeasureString($tagText2, $tagFont2)
$tagBoxW2 = [int]($tagSize2.Width + 20)
$tagBoxH2 = 24
$tagBoxX2 = 144
$tagBoxY2 = 46

$tagBg2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(16, 50, 40))
$tagPen2 = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(16, 185, 129), 1)
$tagTxt2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(52, 211, 153))

$g2.FillRectangle($tagBg2, $tagBoxX2, $tagBoxY2, $tagBoxW2, $tagBoxH2)
$g2.DrawRectangle($tagPen2, $tagBoxX2, $tagBoxY2, $tagBoxW2, $tagBoxH2)
$g2.DrawString($tagText2, $tagFont2, $tagTxt2, ($tagBoxX2 + 10), ($tagBoxY2 + 4))
$tagBg2.Dispose(); $tagPen2.Dispose(); $tagTxt2.Dispose(); $tagFont2.Dispose()

# Titulo Principal Widescreen (ajustado para caber perfeitamente sem encostar na moldura)
$titleFont2 = New-Object System.Drawing.Font($googleSans, 21, [System.Drawing.FontStyle]::Bold)
$titleBrush2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$g2.DrawString("Transcreva Áudios no WhatsApp", $titleFont2, $titleBrush2, 144, 76)
$g2.DrawString("Instantaneamente com IA", $titleFont2, $titleBrush2, 144, 112)
$titleFont2.Dispose(); $titleBrush2.Dispose()

# Descricao em 2 linhas
$subFont2 = New-Object System.Drawing.Font($googleSans, 11.5, [System.Drawing.FontStyle]::Regular)
$subBrush2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(156, 163, 175))
$g2.DrawString("Converta mensagens de voz em texto no seu navegador de forma rápida,", $subFont2, $subBrush2, 55, 168)
$g2.DrawString("fiel e 100% privada usando sua própria chave gratuita da Google.", $subFont2, $subBrush2, 55, 192)
$subFont2.Dispose(); $subBrush2.Dispose()

# 4 Cards / Badges de Recursos no Lado Esquerdo
function DrawMarqueeFeature {
    param($x, $y, $w, $h, $bulletColor, $title, $desc, $borderColor)
    $cardBg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(15, 23, 42))
    $cardBorder = New-Object System.Drawing.Pen($borderColor, 1.2)
    
    $global:g2.FillRectangle($cardBg, $x, $y, $w, $h)
    $global:g2.DrawRectangle($cardBorder, $x, $y, $w, $h)
    
    $dotBrush = New-Object System.Drawing.SolidBrush($bulletColor)
    $global:g2.FillEllipse($dotBrush, ($x + 14), ($y + 14), 8, 8)
    $dotBrush.Dispose()

    $titleFont = New-Object System.Drawing.Font($global:googleSans, 11, [System.Drawing.FontStyle]::Bold)
    $descFont = New-Object System.Drawing.Font($global:googleSans, 9, [System.Drawing.FontStyle]::Regular)
    $titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $descBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(148, 163, 184))
    
    $global:g2.DrawString($title, $titleFont, $titleBrush, ($x + 28), ($y + 8))
    $global:g2.DrawString($desc, $descFont, $descBrush, ($x + 14), ($y + 32))
    
    $cardBg.Dispose(); $cardBorder.Dispose(); $titleBrush.Dispose(); $descBrush.Dispose(); $titleFont.Dispose(); $descFont.Dispose()
}

DrawMarqueeFeature -x 55 -y 250 -w 270 -h 65 -bulletColor ([System.Drawing.Color]::FromArgb(16, 185, 129)) -title "Transcrição Fiel" -desc "IA avançada com máxima precisão." -borderColor ([System.Drawing.Color]::FromArgb(16, 185, 129))
DrawMarqueeFeature -x 340 -y 250 -w 275 -h 65 -bulletColor ([System.Drawing.Color]::FromArgb(6, 182, 212)) -title "100% Privado (BYOK)" -desc "Direto do browser para a Google." -borderColor ([System.Drawing.Color]::FromArgb(6, 182, 212))

DrawMarqueeFeature -x 55 -y 330 -w 270 -h 65 -bulletColor ([System.Drawing.Color]::FromArgb(59, 130, 246)) -title "Cache Inteligente" -desc "Reabra sem novas chamadas à API." -borderColor ([System.Drawing.Color]::FromArgb(59, 130, 246))
DrawMarqueeFeature -x 340 -y 330 -w 275 -h 65 -bulletColor ([System.Drawing.Color]::FromArgb(168, 85, 247)) -title "Pool de Chaves" -desc "Rotação inteligente contra erro 429." -borderColor ([System.Drawing.Color]::FromArgb(168, 85, 247))

# Bottom Bar do lado esquerdo
$pillFont2 = New-Object System.Drawing.Font($googleSans, 9.5, [System.Drawing.FontStyle]::Bold)
$pillBg2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(17, 24, 39))
$pillPen2 = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(30, 58, 80), 1)
$pillTxt2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(226, 232, 240))
$pillCheck2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(16, 185, 129))

$g2.FillRectangle($pillBg2, 55, 420, 560, 36)
$g2.DrawRectangle($pillPen2, 55, 420, 560, 36)
$g2.DrawString("✓ Sem Mensalidade", $pillFont2, $pillCheck2, 70, 429)
$g2.DrawString("✓ Suporte a Modo Dark e Light", $pillFont2, $pillCheck2, 220, 429)
$g2.DrawString("✓ Código Aberto", $pillFont2, $pillCheck2, 450, 429)

$pillBg2.Dispose(); $pillPen2.Dispose(); $pillTxt2.Dispose(); $pillCheck2.Dispose(); $pillFont2.Dispose()

# Lado Direito - Mockup do WhatsApp Centralizado
$screenshot2 = [System.Drawing.Bitmap]::FromFile($srcDrop)
$sW = $screenshot2.Width
$sH = $screenshot2.Height

$mX = 660
$mY = 35
$mPad = 12
$mHeaderH = 30
$mW = $sW + ($mPad * 2)
$mTotalH = $sH + ($mPad * 2) + $mHeaderH

# Sombra
$mShadow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(2, 6, 12))
$g2.FillRectangle($mShadow, $mX + 6, $mY + 6, $mW, $mTotalH)
$mShadow.Dispose()

# Moldura
$mBg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(17, 24, 39))
$g2.FillRectangle($mBg, $mX, $mY, $mW, $mTotalH)
$mBg.Dispose()

$mPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(35, 65, 90), 1.5)
$g2.DrawRectangle($mPen, $mX, $mY, $mW, $mTotalH)
$mPen.Dispose()

# Dots
$dotRed2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(239, 68, 68))
$dotYellow2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(245, 158, 11))
$dotGreen2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(16, 185, 129))
$g2.FillEllipse($dotRed2, $mX + 16, $mY + 10, 9, 9)
$g2.FillEllipse($dotYellow2, $mX + 32, $mY + 10, 9, 9)
$g2.FillEllipse($dotGreen2, $mX + 48, $mY + 10, 9, 9)
$dotRed2.Dispose(); $dotYellow2.Dispose(); $dotGreen2.Dispose()

# Top bar text
$topTxtFont = New-Object System.Drawing.Font($googleSans, 8.5, [System.Drawing.FontStyle]::Regular)
$topTxtBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(148, 163, 184))
$g2.DrawString("web.whatsapp.com - VoiceScribe for WhatsApp™", $topTxtFont, $topTxtBrush, ($mX + 68), ($mY + 8))
$topTxtFont.Dispose(); $topTxtBrush.Dispose()

# Imagem
$g2.DrawImage($screenshot2, ($mX + $mPad), ($mY + $mHeaderH + $mPad), $sW, $sH)
$screenshot2.Dispose()

$jpg2 = Join-Path $outputDir "promo-marquee-1400x560.jpg"
$bmp2.Save($jpg2, $jpgEncoder, $encoderParams)
$g2.Dispose()
$bmp2.Dispose()
$pfc.Dispose()

Write-Host "Bloco promocional de letreiro gerado exclusivamente em JPEG: $jpg2"
