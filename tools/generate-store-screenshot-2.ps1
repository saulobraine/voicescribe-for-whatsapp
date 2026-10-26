Add-Type -AssemblyName System.Drawing

$srcDrop = Join-Path $PSScriptRoot "..\store\Captura de tela_26-10-2026_0731_affaohcbcihedijbhndligbbpmcmfdle.jpeg"
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

$canvasWidth = 1280
$canvasHeight = 800

# Formato 24bppRgb sem canal alfa
$bmp = New-Object System.Drawing.Bitmap($canvasWidth, $canvasHeight, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

# 1. Fundo Gradiente Tech Dark
$bgRect = New-Object System.Drawing.Rectangle(0, 0, $canvasWidth, $canvasHeight)
$bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $bgRect,
    [System.Drawing.Color]::FromArgb(11, 17, 32),
    [System.Drawing.Color]::FromArgb(6, 10, 18),
    [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
)
$g.FillRectangle($bgBrush, $bgRect)
$bgBrush.Dispose()

# Ambient glow no topo
$glowBrush1 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(16, 55, 42))
$g.FillEllipse($glowBrush1, -80, -100, 600, 380)
$glowBrush1.Dispose()

$glowBrush2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(14, 45, 75))
$g.FillEllipse($glowBrush2, 760, -100, 600, 380)
$glowBrush2.Dispose()

# 2. Header & Branding
$logoImg = [System.Drawing.Bitmap]::FromFile($logoPath)
$logoSize = 72
$logoX = 45
$logoY = 32
$g.DrawImage($logoImg, $logoX, $logoY, $logoSize, $logoSize)
$logoImg.Dispose()

# Fontes Google Sans
$titleFont = New-Object System.Drawing.Font($googleSans, 25, [System.Drawing.FontStyle]::Bold)
$tagFont = New-Object System.Drawing.Font($googleSans, 9.5, [System.Drawing.FontStyle]::Bold)
$subFont = New-Object System.Drawing.Font($googleSans, 12, [System.Drawing.FontStyle]::Regular)
$badgeTitleFont = New-Object System.Drawing.Font($googleSans, 11, [System.Drawing.FontStyle]::Bold)
$badgeDescFont = New-Object System.Drawing.Font($googleSans, 9, [System.Drawing.FontStyle]::Regular)
$pillFont = New-Object System.Drawing.Font($googleSans, 10, [System.Drawing.FontStyle]::Bold)

# Eyebrow Pill com medicao dinamica
$tagText = "POOL INTELIGENTE & ROTAÇÃO DE CHAVES"
$tagSize = $g.MeasureString($tagText, $tagFont)
$tagBoxW = [int]($tagSize.Width + 20)
$tagBoxH = 24
$tagBoxX = 132
$tagBoxY = 30

$tagBg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(16, 50, 40))
$tagBorder = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(16, 185, 129), 1)
$tagTextBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(52, 211, 153))

$g.FillRectangle($tagBg, $tagBoxX, $tagBoxY, $tagBoxW, $tagBoxH)
$g.DrawRectangle($tagBorder, $tagBoxX, $tagBoxY, $tagBoxW, $tagBoxH)
$g.DrawString($tagText, $tagFont, $tagTextBrush, ($tagBoxX + 10), ($tagBoxY + 4))

$tagBg.Dispose(); $tagBorder.Dispose(); $tagTextBrush.Dispose()

# Titulo Principal
$titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$g.DrawString("Gerenciador de API Keys com Rotação Automática", $titleFont, $titleBrush, 130, 56)
$titleBrush.Dispose()

# Subtitulo
$subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(156, 163, 175))
$g.DrawString("Cadastre múltiplas chaves gratuitas do Gemini. Alternância inteligente para contornar limites de cota (erro 429).", $subFont, $subBrush, 132, 104)
$subBrush.Dispose()

# 3. Card Central com o Print Real do Pool
$fullImg = [System.Drawing.Bitmap]::FromFile($srcDrop)
$cropRect = New-Object System.Drawing.Rectangle(630, 36, 1112, 730)
$cardBmp = $fullImg.Clone($cropRect, $fullImg.PixelFormat)
$fullImg.Dispose()

# Moldura estilo janela de navegador dark
$cardW = 868
$cardH = 566
$frameX = [int](($canvasWidth - $cardW) / 2)
$frameY = 146

# Sombra suave do Card
$shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(2, 6, 12))
$g.FillRectangle($shadowBrush, $frameX + 6, $frameY + 6, $cardW, $cardH)
$shadowBrush.Dispose()

# Desenhar o Card no Canvas
$g.DrawImage($cardBmp, $frameX, $frameY, $cardW, $cardH)
$cardBmp.Dispose()

# Borda neon elegante ao redor do Card
$cardPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(35, 65, 95), 1.5)
$g.DrawRectangle($cardPen, $frameX, $frameY, $cardW, $cardH)
$cardPen.Dispose()

# 4. Badges Comerciais Laterais em Google Sans
function DrawFeatureCard {
    param($x, $y, $w, $h, $bulletColor, $title, $descLine1, $descLine2, $borderColor)
    $cardBg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(15, 23, 42))
    $cardBorder = New-Object System.Drawing.Pen($borderColor, 1.2)
    
    $global:g.FillRectangle($cardBg, $x, $y, $w, $h)
    $global:g.DrawRectangle($cardBorder, $x, $y, $w, $h)
    
    # Bullet icon circular
    $dotBrush = New-Object System.Drawing.SolidBrush($bulletColor)
    $global:g.FillEllipse($dotBrush, ($x + 12), ($y + 14), 7, 7)
    $dotBrush.Dispose()

    $titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $descBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(148, 163, 184))
    
    $global:g.DrawString($title, $global:badgeTitleFont, $titleBrush, ($x + 24), ($y + 8))
    $global:g.DrawString($descLine1, $global:badgeDescFont, $descBrush, ($x + 12), ($y + 32))
    $global:g.DrawString($descLine2, $global:badgeDescFont, $descBrush, ($x + 12), ($y + 49))
    
    $cardBg.Dispose(); $cardBorder.Dispose(); $titleBrush.Dispose(); $descBrush.Dispose()
}

$sideCardW = 172
$sideCardH = 78

# Cartoes Laterais Esquerdos
$leftX = 18
DrawFeatureCard -x $leftX -y 220 -w $sideCardW -h $sideCardH -bulletColor ([System.Drawing.Color]::FromArgb(16, 185, 129)) -title "Multi-Chaves" -descLine1 "Cadastre quantas" -descLine2 "chaves desejar." -borderColor ([System.Drawing.Color]::FromArgb(16, 185, 129))
DrawFeatureCard -x $leftX -y 330 -w $sideCardW -h $sideCardH -bulletColor ([System.Drawing.Color]::FromArgb(6, 182, 212)) -title "Zero Espera" -descLine1 "Rotação contínua" -descLine2 "sempre ativa." -borderColor ([System.Drawing.Color]::FromArgb(6, 182, 212))
DrawFeatureCard -x $leftX -y 440 -w $sideCardW -h $sideCardH -bulletColor ([System.Drawing.Color]::FromArgb(59, 130, 246)) -title "Auto Cooldown" -descLine1 "Espera inteligente" -descLine2 "se houver erro 429." -borderColor ([System.Drawing.Color]::FromArgb(59, 130, 246))

# Cartoes Laterais Direitos
$rightX = 1090
DrawFeatureCard -x $rightX -y 220 -w $sideCardW -h $sideCardH -bulletColor ([System.Drawing.Color]::FromArgb(16, 185, 129)) -title "100% Grátis" -descLine1 "Use o plano free" -descLine2 "do Google AI Studio." -borderColor ([System.Drawing.Color]::FromArgb(16, 185, 129))
DrawFeatureCard -x $rightX -y 330 -w $sideCardW -h $sideCardH -bulletColor ([System.Drawing.Color]::FromArgb(6, 182, 212)) -title "Seguro Local" -descLine1 "Chaves salvas no" -descLine2 "seu navegador." -borderColor ([System.Drawing.Color]::FromArgb(6, 182, 212))
DrawFeatureCard -x $rightX -y 440 -w $sideCardW -h $sideCardH -bulletColor ([System.Drawing.Color]::FromArgb(168, 85, 247)) -title "Resiliência" -descLine1 "Nunca perca um" -descLine2 "áudio longo." -borderColor ([System.Drawing.Color]::FromArgb(168, 85, 247))

# 5. Barra Inferior com Destaques
$pillY = 728
function DrawBottomPill {
    param($x, $w, $text, $accentColor)
    $bg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(17, 24, 39))
    $pen = New-Object System.Drawing.Pen($accentColor, 1)
    $txt = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(226, 232, 240))
    $checkBrush = New-Object System.Drawing.SolidBrush($accentColor)
    
    $global:g.FillRectangle($bg, $x, $global:pillY, $w, 38)
    $global:g.DrawRectangle($pen, $x, $global:pillY, $w, 38)
    
    $global:g.DrawString("✓", $global:pillFont, $checkBrush, ($x + 12), ($global:pillY + 9))
    $global:g.DrawString($text, $global:pillFont, $txt, ($x + 28), ($global:pillY + 9))
    
    $bg.Dispose(); $pen.Dispose(); $txt.Dispose(); $checkBrush.Dispose()
}

DrawBottomPill -x 35 -w 280 -text "Detecção Automática Erro 429" -accentColor ([System.Drawing.Color]::FromArgb(16, 185, 129))
DrawBottomPill -x 335 -w 280 -text "Monitor de Status por Chave" -accentColor ([System.Drawing.Color]::FromArgb(6, 182, 212))
DrawBottomPill -x 635 -w 310 -text "Validação de Conectividade em 1 Clique" -accentColor ([System.Drawing.Color]::FromArgb(59, 130, 246))
DrawBottomPill -x 965 -w 280 -text "BYOK - Chave Própria e Privada" -accentColor ([System.Drawing.Color]::FromArgb(168, 85, 247))

# 6. Salvar Artefato exclusivamente em JPEG
$jpgPath = Join-Path $outputDir "screenshot-2-1280x800.jpg"

$jpgEncoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.FormatDescription -eq "JPEG" }
$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 96L)
$bmp.Save($jpgPath, $jpgEncoder, $encoderParams)

# Limpeza de recursos
$g.Dispose()
$bmp.Dispose()
$titleFont.Dispose(); $tagFont.Dispose(); $subFont.Dispose()
$badgeTitleFont.Dispose(); $badgeDescFont.Dispose(); $pillFont.Dispose()
$pfc.Dispose()

Write-Host "Sucesso! Screenshot 2 1280x800 gerado exclusivamente em JPEG com Google Sans:"
Write-Host "JPEG: $jpgPath"
