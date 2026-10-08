# 🎙️ WhatsApp Gemini Transcriber

<p align="center">
  <img src="https://raw.githubusercontent.com/saulobraine/whatsapp-gemini-transcriber/master/icons/icon128.png" alt="WhatsApp Gemini Transcriber Logo" width="100" onerror="this.style.display='none'"/>
</p>

<p align="center">
  <strong>Extensão Manifest V3 para navegadores Chromium que transcreve áudios do WhatsApp Web em segundos usando a inteligência artificial do Google Gemini.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-blue?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Manifest V3"/>
  <img src="https://img.shields.io/badge/Google_Gemini-API-8E75C2?style=for-the-badge&logo=googlegemini&logoColor=white" alt="Gemini API"/>
  <img src="https://img.shields.io/badge/Modelo-BYOK-success?style=for-the-badge" alt="BYOK Model"/>
  <img src="https://img.shields.io/badge/Privacidade-100%25_Local-green?style=for-the-badge" alt="Privacy First"/>
  <img src="https://img.shields.io/badge/JavaScript-Vanilla-yellow?style=for-the-badge&logo=javascript&logoColor=black" alt="Vanilla JS"/>
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

## 🚀 Instalação Rápida

Compatível com **Google Chrome**, **Microsoft Edge**, **Brave**, **Opera**, **Vivaldi** e qualquer navegador baseado em Chromium.

### 1. Baixar o Projeto
Clone o repositório ou baixe o código como arquivo ZIP e descompacte em uma pasta de sua preferência:

```bash
git clone https://github.com/saulobraine/whatsapp-gemini-transcriber.git
```

### 2. Carregar no Navegador
1. Abra a página de extensões do seu navegador:
   - **Edge:** `edge://extensions/`
   - **Chrome / Brave:** `chrome://extensions/`
2. Ative a chave seletora **Modo do desenvolvedor** (*Developer mode*) no canto superior.
3. Clique no botão **Carregar sem compactação** (*Load unpacked*).
4. Selecione a pasta onde os arquivos do projeto foram extraídos.

---

## 🔑 Configuração da API Gemini

A extensão utiliza a sua própria chave gratuita da API do Google Gemini.

1. Acesse o [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Faça login com sua conta Google e clique em **Create API Key**.
3. Copie a chave gerada.
4. Clique no ícone da extensão no navegador:
   - Cole a sua chave no campo **Gemini API Key**.
   - Clique em **Atualizar** para listar os modelos disponíveis (ex: `gemini-2.5-flash`, `gemini-3-flash`, etc.).
   - Clique em **Salvar**.
5. *(Opcional)* Clique em **Gerenciar API Keys** no rodapé do popup para cadastrar múltiplas chaves e ativar a rotação automática por cota!

---

## 💻 Como Usar

1. Acesse o [WhatsApp Web](https://web.whatsapp.com/) (recarregue a página com **F5** após instalar a extensão).
2. Abra qualquer conversa com recados ou mensagens de voz.
3. Clique no botão **🎙 Transcrever** que aparece logo abaixo do áudio.
4. Em poucos segundos, o balão com o texto completo será exibido.
5. Use o botão **Copiar** para transferir o texto ou **×** para fechar a visualização quando desejar.

---

## 🏗️ Arquitetura do Projeto

O projeto foi construído seguindo rigorosamente a especificação **Manifest V3** sem dependências externas nem etapas complexas de compilação (*Zero Build Step / Vanilla JS*):

| Arquivo | Função |
| :--- | :--- |
| `manifest.json` | Manifesto V3 definindo permissões, service worker e scripts de conteúdo. |
| `background.js` | Service Worker responsável pela comunicação direta com os endpoints da Google Gemini API (Uploads, Listagem de Modelos e Transcrição). |
| `content.js` | Injetado no WhatsApp Web. Responsável por detectar players de áudio, inserir a interface dos botões/balões e sincronizar histórico via MutationObserver e listeners de scroll. |
| `interceptor.js` | Injetado no contexto da página (*Page Context*) como Web Accessible Resource para capturar blobs de áudio silenciosamente no fluxo de rede do WhatsApp. |
| `popup.html` / `popup.js` | Interface de configuração rápida (seleção de modelo, teste de conexão e chave primária). |
| `admin.html` / `admin.js` | Gerenciador completo de pool de API Keys com estatísticas de uso, cooldown e rotação automática. |

---

## 🔒 Segurança e Privacidade

- **Sem Servidores de Terceiros:** Não coletamos dados, não usamos bancos de dados em nuvem e não temos servidores proxy.
- **Armazenamento Seguro Local:** Suas chaves de API ficam salvas exclusivamente na memória local do seu navegador através de `chrome.storage.local`.
- **Comunicação Criptografada:** As requisições de áudio vão direto do seu computador para os servidores oficiais do Google (`generativelanguage.googleapis.com` via HTTPS).

---

## 🤝 Contribuições

Contribuições são muito bem-vindas! Se você encontrou algum problema ou tem sugestões de melhoria:

1. Faça um Fork do projeto.
2. Crie uma branch para sua funcionalidade: `git checkout -b feat/minha-melhoria`
3. Faça o commit das alterações: `git commit -m "feat(plugin): adicionar minha melhoria"`
4. Envie o push para a branch: `git push origin feat/minha-melhoria`
5. Abra um **Pull Request**.

---

## 📄 Licença

Distribuído sob a licença **MIT**. Consulte o arquivo `LICENSE` para obter mais informações.

<p align="center">
  Desenvolvido com dedicação por <a href="https://github.com/saulobraine">Saulo Braine</a>
</p>
