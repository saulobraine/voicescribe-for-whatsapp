# Política de Privacidade — VoiceScribe for WhatsApp™

**Última atualização:** 26 de outubro de 2026  
**Repositório:** [https://github.com/saulobraine/voicescribe-for-whatsapp](https://github.com/saulobraine/voicescribe-for-whatsapp)

O **VoiceScribe for WhatsApp™** é uma extensão de navegador de código aberto desenvolvida com foco intransigente em privacidade, transparência e controle total do usuário. Esta Política de Privacidade descreve de forma clara e objetiva como as informações são tratadas ao utilizar a extensão.

---

## 1. Princípio Fundamental: Arquitetura Sem Servidor (BYOK)

O VoiceScribe for WhatsApp™ opera sob o modelo **BYOK (Bring Your Own Key — Traga Sua Própria Chave)**:
- **Não possuímos servidores intermediários.**
- **Não possuímos bancos de dados na nuvem.**
- **Não coletamos telemetria, logs de uso ou dados analíticos.**
- Todo o processamento ocorre exclusivamente dentro do seu navegador local e em comunicação direta com os endpoints oficiais e auditados da Google.

---

## 2. Dados Coletados e Finalidade

### 2.1 Chaves de API da Google (Google AI Studio)
- **Armazenamento:** As chaves de API fornecidas pelo usuário são armazenadas exclusivamente no armazenamento local seguro do seu navegador (`chrome.storage.local`).
- **Uso:** Utilizadas única e exclusivamente para autenticar as requisições diretas feitas do seu navegador para a API oficial do Google Gemini (`https://generativelanguage.googleapis.com/`).
- **Acesso:** Nem os desenvolvedores da extensão nem terceiros têm qualquer forma de acesso às suas chaves.

### 2.2 Mensagens de Áudio do WhatsApp
- **Acionamento Sob Demanda:** A extensão **nunca** monitora conversas de forma passiva. Ela só atua no momento em que você clica deliberadamente no botão **[🎙 Transcrever]** de um áudio específico.
- **Transmissão Segura:** O arquivo de áudio é transmitido diretamente do seu navegador para a API do Google Gemini através de conexão segura e criptografada (HTTPS/TLS).
- **Isolamento:** A extensão não acessa, não lê e não transmite mensagens de texto, documentos, fotos, vídeos, nomes de contatos ou metadados de chats.

### 2.3 Textos Transcritos e Cache Local
- O texto resultante da transcrição retornado pela API da Google é exibido na sua interface do WhatsApp Web e pode ser armazenado em cache local no navegador (`chrome.storage.local`) para permitir a reabertura do balão sem novos custos de cota.
- Esse cache pode ser apagado a qualquer momento pelo usuário através do botão "Limpar Cache" no popup da extensão.

---

## 3. Compartilhamento de Dados com Terceiros

O VoiceScribe for WhatsApp™ não vende, não aluga, não compartilha e não transfere quaisquer dados de usuários para empresas de publicidade, corretores de dados (data brokers) ou quaisquer terceiros.

A única comunicação de dados externa realizada pela extensão é o envio do arquivo de áudio para a **Google LLC**, estritamente necessário para a realização da transcrição por Inteligência Artificial, conforme solicitado pelo próprio usuário. O tratamento desse áudio pela Google segue a [Política de Privacidade da Google](https://policies.google.com/privacy) e os [Termos de Serviço das APIs do Google AI Studio](https://ai.google.dev/terms).

---

## 4. Permissões Solicitadas no Navegador

A extensão solicita apenas as permissões mínimas essenciais para sua operação:
- `storage`: Para persistir localmente suas chaves de API, modelo de IA preferido e o cache das transcrições.
- `host_permissions` (`web.whatsapp.com`, `*.whatsapp.net`): Para identificar elementos de áudio na interface do WhatsApp Web e capturar o áudio a ser transcrito quando o usuário clicar no botão.
- `host_permissions` (`generativelanguage.googleapis.com`): Para enviar o áudio e receber a transcrição diretamente da API oficial do Google Gemini.

---

## 5. Direitos do Usuário (LGPD e GDPR)

Em conformidade com a LGPD (Lei Geral de Proteção de Dados - Brasil) e GDPR (Regulamento Geral sobre a Proteção de Dados - UE):
- Você detém controle total sobre todos os seus dados.
- Como nenhum dado pessoal é armazenado em servidores remotos próprios, a exclusão dos seus dados é imediata ao limpar o cache no popup da extensão ou ao desinstalar a extensão do navegador.

---

## 6. Código Aberto e Auditoria

A totalidade do código-fonte do VoiceScribe for WhatsApp™ é pública e auditável sob licença livre no GitHub:
[https://github.com/saulobraine/voicescribe-for-whatsapp](https://github.com/saulobraine/voicescribe-for-whatsapp)

Qualquer usuário ou especialista em segurança da informação pode inspecionar e verificar que a extensão executa estritamente o que está declarado neste documento.

---

## 7. Contato e Dúvidas

Se tiver qualquer dúvida, sugestão ou solicitação referente a esta Política de Privacidade ou ao funcionamento da extensão, entre em contato através das *Issues* oficiais do projeto:  
👉 [https://github.com/saulobraine/voicescribe-for-whatsapp/issues](https://github.com/saulobraine/voicescribe-for-whatsapp/issues)
