# WhatsApp Gemini Transcriber

Extensão independente para Edge/Chromium que captura áudios do WhatsApp Web e envia a transcrição diretamente para a API Gemini usando a chave BYOK do usuário.

## Modelos

O popup consulta `models.list` da Gemini API e filtra os modelos multimodais/documentados como capazes de receber áudio. Modelos Live, TTS, imagem, vídeo e embeddings são excluídos porque não são apropriados para este fluxo de transcrição via `generateContent`.

O `gemini-3.5-transcribe` recebe tratamento especial porque usa a Interactions API e a Files API.

## Instalação

1. Extraia o ZIP.
2. Abra `edge://extensions/`.
3. Ative o Modo de desenvolvedor.
4. Clique em Carregar sem compactação.
5. Selecione esta pasta.
6. Abra/recarregue `https://web.whatsapp.com/`.
7. Abra o popup, informe sua chave Gemini e clique em Atualizar.

## Privacidade

A extensão não usa servidor intermediário próprio. A chave e o modelo ficam no `chrome.storage.local`. O áudio é enviado para os endpoints da Google Gemini API necessários ao modelo selecionado.
