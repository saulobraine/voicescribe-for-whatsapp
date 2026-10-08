# 🎙️ WhatsApp Gemini Transcriber

<p align="center">
  <img src="https://raw.githubusercontent.com/saulobraine/whatsapp-gemini-transcriber/master/icons/icon128.png" alt="WhatsApp Gemini Transcriber Logo" width="100" onerror="this.style.display='none'"/>
</p>

<p align="center">
  <strong>Extensão Manifest V3 desenvolvida em TypeScript que transcreve áudios do WhatsApp Web em segundos usando a API do Google Gemini.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-blue?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Manifest V3"/>
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Google_Gemini-API-8E75C2?style=for-the-badge&logo=googlegemini&logoColor=white" alt="Gemini API"/>
  <img src="https://img.shields.io/badge/Modelo-BYOK-success?style=for-the-badge" alt="BYOK Model"/>
  <img src="https://img.shields.io/badge/Design-Object_Calisthenics-orange?style=for-the-badge" alt="Object Calisthenics"/>
  <img src="https://img.shields.io/badge/Metodologia-XP_/_TDD-red?style=for-the-badge" alt="Extreme Programming"/>
</p>

---

## 🌟 Destaques

- ⚡ **Transcrição com 1 Clique:** Botão 🎙 *Transcrever* injetado discretamente ao lado de cada reprodutor de áudio no WhatsApp Web.
- 💬 **Alinhamento e Estilo Nativos:**
  - **Mensagens Recebidas:** alinhadas à esquerda em balão cinza suave (`#f0f2f5` / `#202c33`).
  - **Mensagens Enviadas:** alinhadas à direita em balão verde característico do WhatsApp (`#d9fdd3` / `#005c4b`).
- 🔄 **Pool de Chaves & Rotação Automática:** Cadastre múltiplas chaves de API do Gemini no gerenciador avançado (`admin.html`). Se uma cota gratuita for atingida (erro 429), a extensão chaveia automaticamente para a próxima chave válida.
- 💾 **Cache Inteligente:** Áudios já transcritos são memorizados localmente. Você pode fechar e reabrir a transcrição instantaneamente sem gastar novas chamadas na API.
- 📋 **Copiar com Um Toque:** Botão para copiar o texto transcrito diretamente para a sua área de transferência.
- 🔇 **Captura Silenciosa:** O áudio é capturado e enviado via streaming interno sem a necessidade de reproduzir o som alto nas caixas.
- 📜 **Resistente ao Histórico Longo (Virtualização):** Compatível com o sistema de lista virtualizada do WhatsApp Web — role meses de conversa para cima e os botões continuarão presentes e funcionais.
- 🌓 **Totalmente Adaptado ao Tema:** Suporte completo a Modo Claro (*Light*) e Modo Escuro (*Dark*).
- 🛡️ **Privacidade em Primeiro Lugar (BYOK):** Modelo *Bring Your Own Key*. Não há servidores intermediários. Toda a comunicação ocorre exclusivamente entre o seu navegador e a API oficial do Google.

---

## 📸 Demonstração Visual

```text
 ┌────────────────────────────────────────────────────────┐
 │ [▶]  ● ılılılllıılıl... 0:16                     13:50  │
 ├────────────────────────────────────────────────────────┤
 │ [🎙 Transcrever]                                       │
 │ ┌────────────────────────────────────────────────────┐ │
 │ │ "Oi, tudo bem? Estou enviando este áudio para      │ │
 │ │ confirmar a nossa reunião de hoje às 15h."         │ │
 │ │                                                    │ │
 │ │ [Copiar]                                       [×] │ │
 │ └────────────────────────────────────────────────────┘ │
 └────────────────────────────────────────────────────────┘
```

---

## 🏛️ Padrões de Projeto & Engenharia de Software

O código foi integralmente reescrito em **TypeScript moderno**, aplicando os princípios de **Extreme Programming (XP)** e as 9 regras de **Object Calisthenics**:

1. **Apenas um nível de indentação por método:** Extração de sub-rotinas e eliminação de blocos aninhados profundos.
2. **Não use ELSE:** Fluxo baseado em retornos antecipados (*guard clauses*) e polimorfismo.
3. **Encapsule primitivos:** Conceitos de domínio modelados como *Value Objects* (`ApiKey`, `ModelIdentifier`, `AudioDataUrl`, `TranscriptionText`, `MessageDirection`).
4. **Uma única operação por linha:** Alta legibilidade sem encadeamentos excessivos.
5. **Não abrevie nomes:** Classes e métodos expressivos e autoexplicativos (`WhatsAppAudioCapturer`, `MessageDirectionDetector`, etc.).
6. **Entidades pequenas e focadas:** Classes concisas e métodos com responsabilidade única (SRP).
7. **Baixo acoplamento:** Composição sobre herança e número reduzido de variáveis de instância.
8. **Coleções de primeira classe:** Arrays encapsulados em classes especializadas com comportamento próprio (`ApiKeyPool`, `ModelList`).
9. **Tell, Don't Ask:** Eliminação de getters/setters anêmicos em favor de métodos orientados a comportamento.

---

## 🚀 Instalação e Desenvolvimento

### 1. Clonar e Instalar Dependências

```bash
git clone https://github.com/saulobraine/whatsapp-gemini-transcriber.git
cd whatsapp-gemini-transcriber
npm install
```

### 2. Comandos Disponíveis

| Comando | Descrição |
| :--- | :--- |
| `npm run build` | Compila o código TypeScript gerando os artefatos prontos na pasta `build/`. |
| `npm run watch` | Modo contínuo que recompila automaticamente em `build/` a cada alteração em `src/`. |
| `npm run typecheck` | Executa a verificação estrita de tipos via compilador `tsc`. |
| `npm test` | Executa a suíte de testes unitários automatizados (`node:test`). |

### 3. Carregar no Navegador
1. Execute `npm run build` para gerar a pasta `build/`.
2. Abra a página de extensões do seu navegador:
   - **Edge:** `edge://extensions/`
   - **Chrome / Brave:** `chrome://extensions/`
3. Ative o **Modo do desenvolvedor** (*Developer mode*).
4. Clique em **Carregar sem compactação** (*Load unpacked*).
5. Selecione a pasta **`build`** gerada neste repositório.

---

## 🔑 Configuração da API Gemini

1. Obtenha sua chave gratuita no [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Clique no ícone da extensão no navegador:
   - Informe sua chave de API.
   - Clique em **Atualizar** para carregar os modelos disponíveis (ex: `gemini-2.5-flash`, `gemini-3.8-flash`).
   - Clique em **Salvar**.
3. *(Opcional)* Clique em **Gerenciar API Keys** para cadastrar múltiplas chaves e ativar a rotação automática por cota.

---

## 🏗️ Estrutura de Diretórios

```text
src/
├── domain/                  # Value Objects e Coleções de Primeira Classe
│   ├── ApiKey.ts
│   ├── ApiKeyPool.ts
│   ├── AudioDataUrl.ts
│   ├── MessageDirection.ts
│   ├── ModelIdentifier.ts
│   ├── ModelList.ts
│   └── TranscriptionText.ts
├── infrastructure/          # Gateways de Chrome Storage e API Gemini
│   ├── ChromeStorageGateway.ts
│   └── GeminiApiClient.ts
├── application/             # Casos de Uso e Orquestração
│   └── TranscribeAudioUseCase.ts
├── content/                 # Injeção e UI no WhatsApp Web
│   ├── MessageDirectionDetector.ts
│   ├── TranscriptionUiFactory.ts
│   ├── WhatsAppAudioCapturer.ts
│   ├── WhatsAppMessageScanner.ts
│   └── index.ts
├── interceptor/             # Script injetado no Page Context
│   ├── PageAudioInterceptor.ts
│   └── index.ts
├── background/              # Service Worker MV3
│   ├── BackgroundMessageRouter.ts
│   └── index.ts
├── popup/                   # Interface de Configurações
│   ├── PopupController.ts
│   └── index.ts
└── admin/                   # Painel Administrativo de Pool de Chaves
    ├── AdminController.ts
    └── index.ts
tests/                       # Suíte de Testes Unitários Automatizados (TDD)
```

---

## 🔒 Segurança e Privacidade

- **100% Local:** Não há servidores proxy, telemetria ou bancos de dados externos.
- **Armazenamento Seguro:** As chaves de API residem exclusivamente em `chrome.storage.local`.
- **Comunicação Direta:** As requisições de áudio vão do seu navegador diretamente para os endpoints seguros da Google Gemini API (`generativelanguage.googleapis.com` via HTTPS).

---

## 📄 Licença

Distribuído sob a licença **MIT**.

<p align="center">
  Desenvolvido com dedicação por <a href="https://github.com/saulobraine">Saulo Braine</a>
</p>
