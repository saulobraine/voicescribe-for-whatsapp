Add-Type -AssemblyName System.Drawing

$srcDrop = "C:\Users\admin\AppData\Local\Temp\Maestri-drops\5b92b5b4-4630-45da-8c64-5b861fa0e22a.png"
$logoPath = (Resolve-Path "$PSScriptRoot\..\icons\icon128.png").Path
$outputDir = "$PSScriptRoot\..\store"

if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

# Carregar a fonte oficial Google Sans via PrivateFontCollection
$pfc = New-Object System.Drawing.Text.PrivateFontCollection
$pfc.AddFontFile((Resolve-Path "$PSScriptRoot\fonts\GoogleSans-Regular.ttf").Path)
$pfc.AddFontFile((Resolve-Path "$PSScriptRoot\fonts\GoogleSans-Bold.ttf").Path)
$pfc.AddFontFile((Resolve-Path "$PSScriptRoot\fonts\GoogleSans-Medium.ttf").Path)
$googleSans = $pfc.Families | Where-Object { $_.Name -eq "Google Sans" } | Select-Object -First 1
if (-not $googleSans) { $googleSans = $pfc.Families[0] }

$canvasWidth = 1280
$canvasHeight = 800

# Formato 24bppRgb sem canal alfa (requisito estrito da Chrome Web Store)
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
$logoX = 50
$logoY = 38
$g.DrawImage($logoImg, $logoX, $logoY, $logoSize, $logoSize)
$logoImg.Dispose()

# Fontes Google Sans
$titleFont = New-Object System.Drawing.Font($googleSans, 26, [System.Drawing.FontStyle]::Bold)
$tagFont = New-Object System.Drawing.Font($googleSans, 9.5, [System.Drawing.FontStyle]::Bold)
$subFont = New-Object System.Drawing.Font($googleSans, 12, [System.Drawing.FontStyle]::Regular)
$badgeTitleFont = New-Object System.Drawing.Font($googleSans, 12, [System.Drawing.FontStyle]::Bold)
$badgeDescFont = New-Object System.Drawing.Font($googleSans, 9.5, [System.Drawing.FontStyle]::Regular)
$pillFont = New-Object System.Drawing.Font($googleSans, 10.5, [System.Drawing.FontStyle]::Bold)

# Eyebrow Pill com medicao dinamica (sem corte ou encostar nas bordas)
$tagText = "GOOGLE GEMINI + WHATSAPP WEB"
$tagSize = $g.MeasureString($tagText, $tagFont)
$tagBoxW = [int]($tagSize.Width + 20)
$tagBoxH = 24
$tagBoxX = 136
$tagBoxY = 36

$tagBg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(16, 50, 40))
$tagBorder = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(16, 185, 129), 1)
$tagTextBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(52, 211, 153))

$g.FillRectangle($tagBg, $tagBoxX, $tagBoxY, $tagBoxW, $tagBoxH)
$g.DrawRectangle($tagBorder, $tagBoxX, $tagBoxY, $tagBoxW, $tagBoxH)
$g.DrawString($tagText, $tagFont, $tagTextBrush, ($tagBoxX + 10), ($tagBoxY + 4))

$tagBg.Dispose(); $tagBorder.Dispose(); $tagTextBrush.Dispose()

# Titulo Principal
$titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$g.DrawString("Transcrição Rápida de Áudio com Inteligência Artificial", $titleFont, $titleBrush, 134, 62)
$titleBrush.Dispose()

# Subtitulo
$subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(156, 163, 175))
$g.DrawString("Converta mensagens de voz em texto instantaneamente no WhatsApp Web usando sua chave Gemini gratuita.", $subFont, $subBrush, 136, 110)
$subBrush.Dispose()

# 3. Card Central com o Print Real do WhatsApp
$screenshot = [System.Drawing.Bitmap]::FromFile($srcDrop)
$shotW = $screenshot.Width
$shotH = $screenshot.Height

# Moldura estilo janela de navegador dark
$frameX = 310
$frameY = 168
$framePad = 12
$headerH = 32
$frameW = $shotW + ($framePad * 2)
$frameTotalH = $shotH + ($framePad * 2) + $headerH

# Sombra do Frame
$shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(2, 6, 12))
$g.FillRectangle($shadowBrush, $frameX + 6, $frameY + 6, $frameW, $frameTotalH)
$shadowBrush.Dispose()

# Fundo do Frame
$frameBg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(17, 24, 39))
$g.FillRectangle($frameBg, $frameX, $frameY, $frameW, $frameTotalH)
$frameBg.Dispose()

# Borda neon suave no Frame
$framePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(35, 65, 90), 1.5)
$g.DrawRectangle($framePen, $frameX, $frameY, $frameW, $frameTotalH)
$framePen.Dispose()

# Janela Top bar (dots Mac/Chromium)
$dotRed = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(239, 68, 68))
$dotYellow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(245, 158, 11))
$dotGreen = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(16, 185, 129))
$g.FillEllipse($dotRed, $frameX + 16, $frameY + 11, 10, 10)
$g.FillEllipse($dotYellow, $frameX + 33, $frameY + 11, 10, 10)
$g.FillEllipse($dotGreen, $frameX + 50, $frameY + 11, 10, 10)
$dotRed.Dispose(); $dotYellow.Dispose(); $dotGreen.Dispose()

# Titulo da janela
$winTitleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(148, 163, 184))
$winTitleFont = New-Object System.Drawing.Font($googleSans, 9, [System.Drawing.FontStyle]::Regular)
$g.DrawString("web.whatsapp.com - VoiceScribe for WhatsApp™", $winTitleFont, $winTitleBrush, ($frameX + 72), ($frameY + 8))
$winTitleBrush.Dispose(); $winTitleFont.Dispose()

# Desenhar o Screenshot no Frame
$g.DrawImage($screenshot, ($frameX + $framePad), ($frameY + $headerH + $framePad), $shotW, $shotH)
$screenshot.Dispose()

# 4. Badges Comerciais Laterais em Google Sans
function DrawFeatureCard {
    param($x, $y, $w, $h, $bulletColor, $title, $descLine1, $descLine2, $borderColor)
    $cardBg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(15, 23, 42))
    $cardBorder = New-Object System.Drawing.Pen($borderColor, 1.2)
    
    $global:g.FillRectangle($cardBg, $x, $y, $w, $h)
    $global:g.DrawRectangle($cardBorder, $x, $y, $w, $h)
    
    # Bullet icon circular
    $dotBrush = New-Object System.Drawing.SolidBrush($bulletColor)
    $global:g.FillEllipse($dotBrush, ($x + 14), ($y + 16), 8, 8)
    $dotBrush.Dispose()

    $titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $descBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(148, 163, 184))
    
    $global:g.DrawString($title, $global:badgeTitleFont, $titleBrush, ($x + 28), ($y + 10))
    $global:g.DrawString($descLine1, $global:badgeDescFont, $descBrush, ($x + 14), ($y + 35))
    $global:g.DrawString($descLine2, $global:badgeDescFont, $descBrush, ($x + 14), ($y + 53))
    
    $cardBg.Dispose(); $cardBorder.Dispose(); $titleBrush.Dispose(); $descBrush.Dispose()
}

# Cartao Lateral Esquerdo (Performance)
DrawFeatureCard -x 40 -y 230 -w 240 -h 82 -bulletColor ([System.Drawing.Color]::FromArgb(16, 185, 129)) -title "Transcrição Fiel" -descLine1 "IA avançada com precisão" -descLine2 "absoluta da fala original." -borderColor ([System.Drawing.Color]::FromArgb(16, 185, 129))
DrawFeatureCard -x 40 -y 345 -w 240 -h 82 -bulletColor ([System.Drawing.Color]::FromArgb(6, 182, 212)) -title "Cache Inteligente" -descLine1 "Reabra balões sem gastar" -descLine2 "chamadas extras à API." -borderColor ([System.Drawing.Color]::FromArgb(6, 182, 212))
DrawFeatureCard -x 40 -y 460 -w 240 -h 82 -bulletColor ([System.Drawing.Color]::FromArgb(59, 130, 246)) -title "Copiar em 1 Toque" -descLine1 "Copie a transcrição direto" -descLine2 "para a área de transferência." -borderColor ([System.Drawing.Color]::FromArgb(59, 130, 246))

# Cartao Lateral Direito (Seguranca e Features)
DrawFeatureCard -x 1000 -y 230 -w 240 -h 82 -bulletColor ([System.Drawing.Color]::FromArgb(16, 185, 129)) -title "100% Privado (BYOK)" -descLine1 "Sem servidores intermediários." -descLine2 "Browser direto à Google." -borderColor ([System.Drawing.Color]::FromArgb(16, 185, 129))
DrawFeatureCard -x 1000 -y 345 -w 240 -h 82 -bulletColor ([System.Drawing.Color]::FromArgb(6, 182, 212)) -title "Pool de Chaves" -descLine1 "Rotação inteligente de cotas" -descLine2 "para evitar erros 429." -borderColor ([System.Drawing.Color]::FromArgb(6, 182, 212))
DrawFeatureCard -x 1000 -y 460 -w 240 -h 82 -bulletColor ([System.Drawing.Color]::FromArgb(168, 85, 247)) -title "Gemini 2.5 & 3.8" -descLine1 "Modelos multimodais" -descLine2 "ultra velozes e econômicos." -borderColor ([System.Drawing.Color]::FromArgb(168, 85, 247))

# 5. Barra Inferior com Destaques
$pillY = 720
function DrawBottomPill {
    param($x, $w, $text, $accentColor)
    $bg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(17, 24, 39))
    $pen = New-Object System.Drawing.Pen($accentColor, 1)
    $txt = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(226, 232, 240))
    $checkBrush = New-Object System.Drawing.SolidBrush($accentColor)
    
    $global:g.FillRectangle($bg, $x, $global:pillY, $w, 38)
    $global:g.DrawRectangle($pen, $x, $global:pillY, $w, 38)
    
    # Check mark visual
    $global:g.DrawString("✓", $global:pillFont, $checkBrush, ($x + 14), ($global:pillY + 9))
    $global:g.DrawString($text, $global:pillFont, $txt, ($x + 32), ($global:pillY + 9))
    
    $bg.Dispose(); $pen.Dispose(); $txt.Dispose(); $checkBrush.Dispose()
}

DrawBottomPill -x 55 -w 270 -text "Sem Assinatura Mensal" -accentColor ([System.Drawing.Color]::FromArgb(16, 185, 129))
DrawBottomPill -x 350 -w 275 -text "Funciona em Áudios Longos" -accentColor ([System.Drawing.Color]::FromArgb(6, 182, 212))
DrawBottomPill -x 650 -w 275 -text "Suporte a Modo Dark e Light" -accentColor ([System.Drawing.Color]::FromArgb(59, 130, 246))
DrawBottomPill -x 950 -w 275 -text "Código Aberto e Seguro" -accentColor ([System.Drawing.Color]::FromArgb(168, 85, 247))

# 6. Salvar Artefatos exclusivamente em JPEG
$jpgPath = Join-Path $outputDir "screenshot-1-1280x800.jpg"

# Salvar JPEG de alta qualidade
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

Write-Host "Sucesso! Screenshot 1280x800 gerado exclusivamente em JPEG com Google Sans:"
Write-Host "JPEG: $jpgPath"
