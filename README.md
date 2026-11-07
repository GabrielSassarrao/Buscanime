# Buscanime

O **Buscanime** é um aplicativo móvel completo e moderno desenvolvido em React Native para facilitar a busca, o acompanhamento e a organização da sua biblioteca pessoal de animes. O projeto consome dados em tempo real da **Jikan API (MyAnimeList)** com integração e fallback inteligente via **AniList GraphQL**.

## ✨ Funcionalidades Principais

* 🔍 **Busca Ilimitada & Calendário Semanal:** Pesquise animes no catálogo global com paginação infinita, busca combinada por nome e ano, além de um carrossel interativo com os lançamentos de cada dia da semana.
* 🎲 **Roleta Inteligente (Sorteio):** Sugestão automática de animes baseada no seu histórico de gêneros mais assistidos ou filtrada apenas pelos seus favoritos ainda não vistos.
* 📂 **Minha Lista (Biblioteca Pessoal):**
  * Salve animes como **Favoritos** ❤️ e **Vistos** ✅ de maneira independente ou integrada.
  * Controle de episódios assistidos um a um com barra de progresso automática.
  * Sincronização inteligente de episódios, notas, sinopses traduzidas (PT-BR) e alertas de lançamento semanal ou fim de temporada.
* ⚡ **Filtros e Ordenação Avançada:**
  * Filtre por status de lançamento (*Em Andamento*, *Finalizado*) e status de visualização (*Visto*, *Não Visto*, *Todos*).
  * **Filtro Multi-Gênero nos Favoritos:** Combine um ou vários gêneros simultaneamente dentro da sua lista de favoritos.
  * Ordenação instantânea por ordem alfabética (A-Z), nota (melhor avaliados) e ano de lançamento (mais novos/mais antigos).
  * Controle de exibição de conteúdo adulto (+18 / NSFW).
* 📊 **Estatísticas Detalhadas e Interativas:** Acompanhe o tempo total assistido (dias, horas e episódios) e a distribuição de animes por gênero através do carrossel deslizante ou do ranking completo — toque em qualquer gênero para abrir diretamente todos os seus favoritos daquela categoria.
* 📋 **Cópia Rápida de Títulos:** Botão integrado nos detalhes do anime e na roleta para copiar o nome original do anime com 1 toque, facilitando buscas externas.
* 💾 **Backup & Restauração Inteligente:**
  * Auto-backup automático no dispositivo a cada alteração.
  * Exporte e importe seus dados em `.json` ou via código em texto (Copiar/Colar) em plataformas móveis e web.
* 🌗 **Interface Moderna:** Suporte completo a Modo Escuro e Claro com paleta customizada em tons azul marinho profundo e texto de alto contraste.

---

## 🚀 Novidades da Versão (v2.4.7)

* 🎯 **Filtro por Gêneros nos Favoritos (Seleção Múltipla):** Adicionada barra deslizante de gêneros diretamente na aba de Favoritos, permitindo filtrar sua biblioteca por uma ou mais categorias ao mesmo tempo.
* 🔗 **Atalho Interativo nas Estatísticas de Gênero:** Agora, ao clicar em qualquer gênero no carrossel deslizante do Menu ou na lista completa de *Animes Vistos por Gênero*, o aplicativo abre automaticamente a aba de Favoritos filtrada com todos os seus animes salvos daquele gênero.
* 📋 **Botão de Copiar Nome do Anime:** Novo botão rápido no cabeçalho e no card de detalhes (além do modal de sorteio) para copiar o título do anime para a área de transferência instantaneamente.
* 💾 **Correção de Persistência no Refresh e Lançamentos Futuros:**
  * Corrigido o bug em que alguns animes voltavam ao estado anterior ou trocavam entre *Em Andamento* e *Finalizado* após fechar e reabrir o aplicativo.
  * Melhoria na sincronização de animes recém-anunciados (2026/2027) sem nota definida (`N/A`) ou cadastrados exclusivamente pelo ID do AniList.

### Destaques da Versão Anterior (v2.4.6)

* 🔄 **Sincronização Contextual Inteligente:**
  * **Refresh Individual:** Atualiza exclusivamente os dados e a sinopse do anime aberto na tela sem sobrecarregar a API.
  * **Refresh Global com Barra de Progresso e Botão Parar:** Sincronização da biblioteca completa em lotes com salvamento parcial contínuo e opção de interromper a qualquer momento.
* 🎭 **Estatísticas por Gênero no Menu:** Carrossel deslizante interativo e submenu detalhado mostrando quantos animes e episódios você assistiu em cada gênero.

---

## 📲 Como Baixar e Instalar (Android)

Para instalar a versão mais recente (**v2.4.7**) no seu smartphone Android:

1. Acesse a aba **Releases** no repositório.
2. Baixe o arquivo binário `Buscanime.apk`.
3. Abra o arquivo no dispositivo e confirme a instalação.

> **Nota:** Caso solicitado, permita a instalação a partir de *"Fontes Desconhecidas"* nas configurações do Android.

---

## 🛠️ Tecnologias Utilizadas

* **React Native** com **Expo (SDK 54)**
* **Expo Router** (Navegação estruturada por rotas)
* **AsyncStorage** (Persistência offline e Auto-Backup)
* **Expo Clipboard & Notifications** (Área de transferência e alertas locais)
* **AniList GraphQL API & Jikan API v4**
* **EAS Build** (Geração remota de binários APK)

---

Desenvolvido por **Gabriel de Sassarrão Moraes Ramos**.