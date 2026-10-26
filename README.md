# 🎙️ VoiceScribe for WhatsApp™

<p align="center">
  <img src="icons/icon128.png" alt="VoiceScribe for WhatsApp™ Logo" width="128"/>
</p>

<p align="center">
  <strong>Extensão Chromium / Edge (Manifest V3) desenvolvida em TypeScript que transcreve mensagens de voz do WhatsApp Web em segundos utilizando os modelos avançados de IA do Google Gemini.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-blue?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Manifest V3"/>
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Google_Gemini-API-8E75C2?style=for-the-badge&logo=googlegemini&logoColor=white" alt="Gemini API"/>
  <img src="https://img.shields.io/badge/Modelo-BYOK-success?style=for-the-badge" alt="BYOK Model"/>
  <img src="https://img.shields.io/badge/Design-Glassmorphism_Dark-0ea5e9?style=for-the-badge" alt="Glassmorphism Dark"/>
  <img src="https://img.shields.io/badge/Design-Object_Calisthenics-orange?style=for-the-badge" alt="Object Calisthenics"/>
  <img src="https://img.shields.io/badge/Metodologia-XP_/_TDD-red?style=for-the-badge" alt="Extreme Programming"/>
</p>

---

## 🌟 Destaques & Funcionalidades

- ⚡ **Transcrição com 1 Clique:** Botão 🎙 *Transcrever* injetado discretamente ao lado de cada reprodutor de áudio no WhatsApp Web.
- 🎨 **Nova Identidade Visual Neon Glassmorphism:**
  - Interface moderna inspirada no **Google AI Studio** e no verde característico do **WhatsApp**.
  - Gradiente fluido de alta tecnologia: Verde WhatsApp (`#10B981`) ➔ Ciano Tecnológico (`#06B6D4`) ➔ Azul Elétrico Gemini (`#3B82F6`).
  - Painéis translúcidos em *dark glassmorphism* com suporte nativo aos modos Claro (*Light*) e Escuro (*Dark*) do WhatsApp Web.
- 🔄 **Pool de Chaves & Rotação Inteligente (Round-Robin):**
  - Cadastre múltiplas chaves de API do Gemini no gerenciador avançado (`admin.html`).
  - Se uma chave atingir a cota gratuita da Google (erro 429), a extensão aplica *cooldown* temporário e seleciona automaticamente a próxima chave disponível.
- 💾 **Cache Local Instantâneo:** Transcrições já realizadas são salvas no armazenamento local. Você pode fechar e reabrir balões sem gastar requisições adicionais à API.
- 📋 **Copiar com Um Toque:** Botão para copiar o texto transcrito diretamente para a sua área de transferência com feedback visual instantâneo.
- 🔇 **Captura Silenciosa:** O áudio é interceptado e transmitido via streaming sem necessidade de reprodução com som alto nos alto-falantes.
- 📜 **Resistente à Virtualização do Chat:** Monitoramento contínuo por `MutationObserver` e redetecção adaptativa para conversas com histórico longo.
- 🛡️ **Privacidade em Primeiro Lugar (BYOK):** Modelo *Bring Your Own Key*. Não há servidores intermediários. Toda a comunicação ocorre exclusivamente entre o seu navegador e a API oficial do Google Gemini.

---

## 📸 Demonstração da Interface Injetada

```text
 ┌────────────────────────────────────────────────────────┐
 │ [▶]  ● ılılılllıılıl... 0:18                     14:32  │
 ├────────────────────────────────────────────────────────┤
 │ [🎙 Transcrever]                                       │
 │ ┌────────────────────────────────────────────────────┐ │
 │ │ "Olá! Confirmando a nossa reunião para hoje às     │ │
 │ │ 15h. Segue a pauta em anexo."                      │ │
 │ │                                                    │ │
 │ │ [Copiar]                                       [×] │ │
 │ └────────────────────────────────────────────────────┘ │
 └────────────────────────────────────────────────────────┘
```

---

## 🏛️ Arquitetura de Software & Princípios

O projeto foi totalmente construído em **TypeScript rigoroso**, seguindo a metodologia **Extreme Programming (XP)**, **Test-Driven Development (TDD)** e as 9 regras de **Object Calisthenics**:

1. **Apenas um nível de indentação por método:** Extração clara de funções e legibilidade máxima.
2. **Não use ELSE:** Fluxo controlado por retornos antecipados (*guard clauses*).
3. **Encapsule primitivos:** Conceitos de negócio modelados como *Value Objects* (`ApiKey`, `ModelIdentifier`, `AudioDataUrl`, `TranscriptionText`, `MessageDirection`).
4. **Uma única operação por linha:** Código limpo e declarativo.
5. **Não abrevie nomes:** Classes e métodos autoexplicativos (`WhatsAppAudioCapturer`, `MessageDirectionDetector`, etc.).
6. **Entidades pequenas e focadas:** Classes concisas e métodos com responsabilidade única (SRP).
7. **Baixo acoplamento:** Composição orientada a interfaces e gateways.
8. **Coleções de primeira classe:** Arrays encapsulados em classes de domínio especializadas (`ApiKeyPool`, `ModelList`).
9. **Tell, Don't Ask:** Comportamento orientado a intenção, sem expor mutabilidade interna desnecessária.

---

## 🚀 Instalação e Execução

### 1. Clonar e Instalar Dependências

```bash
git clone -b typescript https://github.com/saulobraine/whatsapp-gemini-transcriber.git
cd whatsapp-gemini-transcriber
npm install
```

### 2. Comandos Disponíveis

| Comando | Descrição |
| :--- | :--- |
| `npm run build` | Compila o TypeScript e copia os assets prontos para a pasta `./build/`. |
| `npm run watch` | Observa arquivos em `src/` e recompila incrementalmente em `./build/`. |
| `npm run typecheck` | Executa a verificação estrita de tipagem via `tsc --noEmit`. |
| `npm test` | Executa a suíte de 18 testes unitários automatizados com `node:test`. |

### 3. Carregar a Extensão no Navegador

1. Execute o build para gerar a pasta `build/`:
   ```bash
   npm run build
   ```
2. Abra a página de gerenciamento de extensões:
   - **Google Chrome / Brave:** `chrome://extensions/`
   - **Microsoft Edge:** `edge://extensions/`
3. Ative a chave **Modo do desenvolvedor** (*Developer mode*).
4. Clique no botão **Carregar sem compactação** (*Load unpacked*).
5. Selecione a pasta **`build`** na raiz deste repositório.

---

## 🔑 Configuração da API Gemini

1. Obtenha sua chave de API gratuitamente no [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Clique no ícone da extensão na barra de ferramentas do navegador:
   - Clique em **🗝️ Gerenciar API Keys** e adicione uma ou mais chaves ao pool.
   - Clique em **Atualizar (↻)** no popup para carregar os modelos compatíveis com áudio (ex: `gemini-2.5-flash`, `gemini-3.8-flash`, etc.).
   - Clique em **Salvar**.
3. Abra o [WhatsApp Web](https://web.whatsapp.com/), abra uma conversa com mensagem de áudio e clique no botão **🎙 Transcrever**.

---

## 📁 Estrutura do Código-Fonte

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
icons/                       # Ícones oficiais nos tamanhos padrão Chromium
tests/                       # 18 Testes Unitários Automatizados (TDD)
build/                       # Artefatos compilados prontos para uso (gerado por build)
```

---

## 🚀 CI/CD & Publicação Contínua nas Lojas

### 🌿 Diretiva de Branches & Git Flow
- **Branch de Desenvolvimento (`develop`):** **Todos os commits e trabalhos em andamento devem ser enviados e publicados obrigatoriamente na branch `develop`**.
- **Branch Principal (`master` / `main`):** Protegida. Recebe alterações exclusivamente por meio de Pull Requests originados de `develop`.
- **Gatilho de Publicação:** O merge de um PR de `develop` para a branch principal dispara o pipeline de versionamento automático SemVer e deploy nas lojas.

### ⚙️ Pipeline Automatizado (GitHub Actions)
O repositório conta com um workflow automatizado em [`.github/workflows/publish-extension.yml`](.github/workflows/publish-extension.yml). Sempre que um Pull Request é aprovado e mergeado na branch principal:

1. Os commits são inspecionados via Conventional Commits para calcular a próxima versão SemVer (`patch`, `minor` ou `major`).
2. O campo `"version"` é sincronizado automaticamente em `package.json` e `manifest.json`.
3. Uma **Git Tag** e uma **GitHub Release** são geradas com notas de atualização automáticas.
4. A extensão é compilada em TypeScript e o pacote `.zip` gerado é publicado nas lojas oficiais.

### 🔑 Configuração de GitHub Secrets

Para habilitar a publicação automática, adicione as seguintes variáveis secretas em **Settings > Secrets and variables > Actions** do repositório:

#### 🌐 Google Chrome Web Store
> **Nota:** O primeiro upload da extensão deve ser feito manualmente no [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) para registrar o item e obter o `CHROME_EXTENSION_ID`.

| Secret | Descrição | Onde Obter |
| :--- | :--- | :--- |
| `CHROME_EXTENSION_ID` | ID alfanumérico único da extensão na loja | URL do item no Chrome Web Store Developer Console |
| `CHROME_CLIENT_ID` | OAuth 2.0 Client ID do Google Cloud | [Google Cloud Console](https://console.cloud.google.com/) > APIs & Services > Credentials |
| `CHROME_CLIENT_SECRET` | OAuth 2.0 Client Secret do Google Cloud | [Google Cloud Console](https://console.cloud.google.com/) > APIs & Services > Credentials |
| `CHROME_REFRESH_TOKEN` | Token de atualização OAuth 2.0 | Gerado via fluxo OAuth autorizando a Chrome Web Store API |

#### 🌐 Microsoft Edge Add-ons
> **Nota:** O primeiro upload também deve ser feito manualmente no [Microsoft Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/overview).

| Secret | Descrição | Onde Obter |
| :--- | :--- | :--- |
| `EDGE_PRODUCT_ID` | ID do produto no painel de extensões do Edge | Partner Center > Visão Geral da Extensão |
| `EDGE_CLIENT_ID` | Client ID da API de publicação | Partner Center > Configurações da Conta > Gerenciamento de Acesso à API |
| `EDGE_API_KEY` | Chave de API secreta (Client Secret) | Partner Center > Configurações da Conta > Gerenciamento de Acesso à API |

---

## 🔒 Segurança e Privacidade

- **Armazenamento 100% Local:** Suas chaves de API e transcrições ficam guardadas exclusivamente no `chrome.storage.local` do seu navegador.
- **Sem Servidores Intermediários:** As requisições de áudio vão diretamente do seu navegador aos endpoints HTTPS oficiais da Google (`generativelanguage.googleapis.com`).
- **Nenhuma Coleta de Dados:** O código não possui telemetria, rastreadores ou chamadas para servidores de terceiros.

---

## ⚖️ Aviso Legal / Disclaimer

*Aviso legal: WhatsApp é uma marca registrada da Meta Platforms, Inc. Google Gemini é uma marca registrada da Google LLC. VoiceScribe for WhatsApp™ é um projeto independente e não possui vínculo, patrocínio ou endosso da Meta Platforms ou da Google.*

---

## 📄 Licença

Distribuído sob a licença **MIT**.

<p align="center">
  Desenvolvido com dedicação por <a href="https://github.com/saulobraine">Saulo Braine</a>
</p>
