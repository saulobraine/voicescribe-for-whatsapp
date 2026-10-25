Add-Type -ReferencedAssemblies "System.Drawing" -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

public class WhatsAppGeminiPreciseIcon
{
    public static void Generate(string outputDir)
    {
        int masterSize = 1024;
        using (Bitmap master = new Bitmap(masterSize, masterSize, PixelFormat.Format32bppArgb))
        {
            using (Graphics g = Graphics.FromImage(master))
            {
                g.Clear(Color.Transparent);
                g.SmoothingMode = SmoothingMode.HighQuality;
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                g.CompositingQuality = CompositingQuality.HighQuality;

                // Centro óptico
                float cx = 525f;
                float cy = 485f;
                float rOut = 370f;
                float rIn = 265f; // Espessura generosa de 105px para impacto visual

                // Ângulos do arco circular do WhatsApp
                float angleStart = 140f; // lateral esquerda
                float angleEnd = 104f;   // base inferior
                float sweepAngle = 360f - (angleStart - angleEnd); // 324° no sentido horário

                // ========================================================
                // 1. SILHUETA OFICIAL DO BALÃO WHATSAPP
                // ========================================================
                using (GraphicsPath outerPath = new GraphicsPath())
                {
                    // Arco do balão
                    outerPath.AddArc(cx - rOut, cy - rOut, rOut * 2, rOut * 2, angleStart, sweepAngle);

                    // Ponto 2 (fim do arco na base em 104°):
                    double radEnd = angleEnd * Math.PI / 180.0;
                    float pEnd_X = cx + (float)(rOut * Math.Cos(radEnd));
                    float pEnd_Y = cy + (float)(rOut * Math.Sin(radEnd));

                    // Ponta da cauda clássica triangular do WhatsApp:
                    PointF tip = new PointF(cx - rOut * 0.94f, cy + rOut * 0.96f);

                    // Ponto 1 (início do arco na lateral em 140°):
                    double radStart = angleStart * Math.PI / 180.0;
                    float pStart_X = cx + (float)(rOut * Math.Cos(radStart));
                    float pStart_Y = cy + (float)(rOut * Math.Sin(radStart));

                    // Linhas retas clássicas da cauda do WhatsApp com cantos arredondados
                    outerPath.AddLine(pEnd_X, pEnd_Y, tip.X, tip.Y);
                    outerPath.AddLine(tip.X, tip.Y, pStart_X, pStart_Y);
                    outerPath.CloseFigure();

                    // Anel vazado (centro 100% transparente)
                    using (GraphicsPath ringPath = new GraphicsPath(FillMode.Alternate))
                    {
                        ringPath.AddPath(outerPath, false);
                        ringPath.AddEllipse(cx - rIn, cy - rIn, rIn * 2, rIn * 2);

                        // Gradiente luminoso vibrante idêntico à Opção 2:
                        using (LinearGradientBrush ringBrush = new LinearGradientBrush(
                            new PointF(cx - rOut, cy + rOut),
                            new PointF(cx + rOut, cy - rOut),
                            Color.FromArgb(255, 37, 211, 102),
                            Color.FromArgb(255, 41, 121, 255)))
                        {
                            ColorBlend blend = new ColorBlend(4);
                            blend.Colors = new Color[] {
                                Color.FromArgb(255, 37, 211, 102),   // Verde WhatsApp
                                Color.FromArgb(255, 0, 230, 145),    // Verde neon
                                Color.FromArgb(255, 0, 220, 255),    // Ciano Gemini
                                Color.FromArgb(255, 45, 120, 255)    // Azul elétrico Gemini
                            };
                            blend.Positions = new float[] { 0.0f, 0.32f, 0.68f, 1.0f };
                            ringBrush.InterpolationColors = blend;

                            g.FillPath(ringBrush, ringPath);
                        }

                        // Brilho especular sutil na borda
                        using (Pen shinePen = new Pen(Color.FromArgb(170, 255, 255, 255), 5f))
                        {
                            shinePen.LineJoin = LineJoin.Round;
                            g.DrawPath(shinePen, outerPath);
                            g.DrawEllipse(shinePen, cx - rIn, cy - rIn, rIn * 2, rIn * 2);
                        }
                    }
                }

                // ========================================================
                // 2. ONDAS SONORAS DE TRANSCRIÇÃO (AUDIO FREQUENCY BARS)
                // ========================================================
                DrawAudioWaveform(g, cx, cy, rIn);

                // ========================================================
                // 3. ESTRELA DE 4 PONTAS DO GOOGLE GEMINI AI
                // ========================================================
                DrawGeminiStar(g, cx, cy, 210f, 40f);
            }

            // Exportar para todos os tamanhos da extensão
            int[] sizes = new int[] { 16, 32, 48, 128, 512 };
            foreach (int sz in sizes)
            {
                using (Bitmap resized = new Bitmap(sz, sz, PixelFormat.Format32bppArgb))
                {
                    using (Graphics g = Graphics.FromImage(resized))
                    {
                        g.Clear(Color.Transparent);
                        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                        g.SmoothingMode = SmoothingMode.HighQuality;
                        g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                        g.CompositingQuality = CompositingQuality.HighQuality;
                        g.DrawImage(master, new Rectangle(0, 0, sz, sz));
                    }
                    string dest = System.IO.Path.Combine(outputDir, "icon" + sz + ".png");
                    resized.Save(dest, ImageFormat.Png);
                }
            }

            master.Save(System.IO.Path.Combine(outputDir, "icon-transparent.png"), ImageFormat.Png);
        }
    }

    private static void DrawAudioWaveform(Graphics g, float cx, float cy, float rIn)
    {
        float totalWidth = rIn * 2f * 0.94f;
        float startX = cx - totalWidth / 2f;
        int barCount = 42;
        float spacing = totalWidth / (barCount - 1);

        for (int i = 0; i < barCount; i++)
        {
            float x = startX + i * spacing;
            float t = (float)i / (barCount - 1);

            // Espaço central reservado para a estrela
            if (Math.Abs(x - cx) < 38f) continue;

            float envelope = (float)Math.Sin(t * Math.PI);
            float harmonic = (float)(Math.Sin(t * Math.PI * 6.8) * 0.55 + Math.Cos(t * Math.PI * 3.1) * 0.45);
            float h = Math.Abs(harmonic) * 95f * envelope + 20f;

            // Cores: Verde WhatsApp -> Ciano -> Azul -> Violeta
            int red = (int)(37 + t * 145);
            int grn = (int)(211 + (1f - t) * 20 - t * 115);
            int blu = (int)(120 + t * 135);
            red = Math.Max(0, Math.Min(255, red));
            grn = Math.Max(0, Math.Min(255, grn));
            blu = Math.Max(0, Math.Min(255, blu));

            using (Pen barPen = new Pen(Color.FromArgb(230, red, grn, blu), 7f))
            {
                barPen.StartCap = LineCap.Round;
                barPen.EndCap = LineCap.Round;
                g.DrawLine(barPen, x, cy - h / 2f, x, cy + h / 2f);
            }
        }

        // Ondas senoidais neon
        DrawSineLine(g, cx, cy, totalWidth * 1.05f, 45f, 3.2, Color.FromArgb(240, 0, 240, 255), Color.FromArgb(240, 170, 85, 255), 9f);
        DrawSineLine(g, cx, cy, totalWidth * 0.96f, 32f, 4.8, Color.FromArgb(210, 37, 211, 102), Color.FromArgb(210, 0, 220, 255), 6f);
    }

    private static void DrawSineLine(Graphics g, float cx, float cy, float width, float amp, double freq, Color c1, Color c2, float thickness)
    {
        using (GraphicsPath path = new GraphicsPath())
        {
            int pts = 70;
            PointF[] points = new PointF[pts];
            float left = cx - width / 2f;
            for (int i = 0; i < pts; i++)
            {
                float t = (float)i / (pts - 1);
                float x = left + t * width;
                float env = (float)Math.Sin(t * Math.PI);
                float y = cy + (float)Math.Sin(t * Math.PI * freq) * amp * env;
                points[i] = new PointF(x, y);
            }
            path.AddCurve(points, 0.45f);

            using (LinearGradientBrush brush = new LinearGradientBrush(
                new PointF(left, cy),
                new PointF(left + width, cy),
                c1, c2))
            {
                using (Pen pen = new Pen(brush, thickness))
                {
                    pen.StartCap = LineCap.Round;
                    pen.EndCap = LineCap.Round;
                    g.DrawPath(pen, path);
                }
            }
        }
    }

    private static void DrawGeminiStar(Graphics g, float cx, float cy, float outerR, float innerR)
    {
        using (GraphicsPath starPath = new GraphicsPath())
        {
            float vertR = outerR * 1.06f;
            float horizR = outerR * 0.94f;

            PointF top = new PointF(cx, cy - vertR);
            PointF right = new PointF(cx + horizR, cy);
            PointF bottom = new PointF(cx, cy + vertR);
            PointF left = new PointF(cx - horizR, cy);

            starPath.AddBezier(top, new PointF(cx, cy - innerR * 1.35f), new PointF(cx + innerR * 1.35f, cy), right);
            starPath.AddBezier(right, new PointF(cx + innerR * 1.35f, cy), new PointF(cx, cy + innerR * 1.35f), bottom);
            starPath.AddBezier(bottom, new PointF(cx, cy + innerR * 1.35f), new PointF(cx - innerR * 1.35f, cy), left);
            starPath.AddBezier(left, new PointF(cx - innerR * 1.35f, cy), new PointF(cx, cy - innerR * 1.35f), top);
            starPath.CloseFigure();

            // Gradiente cósmico Gemini
            using (LinearGradientBrush starBrush = new LinearGradientBrush(
                new PointF(cx - outerR, cy - outerR),
                new PointF(cx + outerR, cy + outerR),
                Color.FromArgb(255, 0, 235, 255),
                Color.FromArgb(255, 140, 60, 255)))
            {
                ColorBlend blend = new ColorBlend(3);
                blend.Colors = new Color[] {
                    Color.FromArgb(255, 0, 240, 255),
                    Color.FromArgb(255, 45, 115, 255),
                    Color.FromArgb(255, 160, 70, 255)
                };
                blend.Positions = new float[] { 0.0f, 0.5f, 1.0f };
                starBrush.InterpolationColors = blend;
                g.FillPath(starBrush, starPath);
            }

            // Borda branca brilhante
            using (Pen starBorder = new Pen(Color.FromArgb(250, 255, 255, 255), 6.5f))
            {
                g.DrawPath(starBorder, starPath);
            }

            // Núcleo branco puro incandescente
            using (GraphicsPath corePath = new GraphicsPath())
            {
                float coreOuter = outerR * 0.44f;
                float coreInner = innerR * 0.38f;

                PointF cTop = new PointF(cx, cy - coreOuter * 1.06f);
                PointF cRight = new PointF(cx + coreOuter * 0.94f, cy);
                PointF cBottom = new PointF(cx, cy + coreOuter * 1.06f);
                PointF cLeft = new PointF(cx - coreOuter * 0.94f, cy);

                corePath.AddBezier(cTop, new PointF(cx, cy - coreInner), new PointF(cx + coreInner, cy), cRight);
                corePath.AddBezier(cRight, new PointF(cx + coreInner, cy), new PointF(cx, cy + coreInner), cBottom);
                corePath.AddBezier(cBottom, new PointF(cx, cy + coreInner), new PointF(cx - coreInner, cy), cLeft);
                corePath.AddBezier(cLeft, new PointF(cx - coreInner, cy), new PointF(cx, cy - coreInner), cTop);
                corePath.CloseFigure();

                using (SolidBrush whiteCore = new SolidBrush(Color.FromArgb(255, 255, 255, 255)))
                {
                    g.FillPath(whiteCore, corePath);
                }
            }

            // Ponto de luz hiper-brilhante no centro
            using (SolidBrush pureGlow = new SolidBrush(Color.FromArgb(255, 255, 255, 255)))
            {
                g.FillEllipse(pureGlow, cx - 18f, cy - 18f, 36f, 36f);
            }
        }
    }
}
"@

$outputDir = "$PSScriptRoot\..\icons"
[WhatsAppGeminiPreciseIcon]::Generate($outputDir)

# Atualizar favicon.ico
$icon32 = [System.Drawing.Bitmap]::FromFile("$outputDir\icon32.png")
$iconHandle = $icon32.GetHicon()
$ico = [System.Drawing.Icon]::FromHandle($iconHandle)
$stream = [System.IO.File]::Create("$outputDir\favicon.ico")
$ico.Save($stream)
$stream.Close()
$icon32.Dispose()

Write-Host "Ícones gerados com sucesso."
