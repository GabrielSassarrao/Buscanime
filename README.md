Buscanime

O Buscanime é um aplicativo móvel completo e moderno desenvolvido em React Native para facilitar a busca, o acompanhamento e a organização da sua biblioteca pessoal de animes. O projeto consome dados em tempo real da Jikan API (MyAnimeList) com fallback inteligente via AniList GraphQL.

✨ Funcionalidades Principais

🔍 Busca Ilimitada: Pesquise animes no catálogo global com paginação infinita e busca combinada por nome e ano.

📂 Minha Lista (Biblioteca Pessoal):

Salve animes como Favoritos ❤️ e Vistos ✅ de maneira independente.

Controle de episódios assistidos um a um com barra de progresso.

Sincronização inteligente de episódios e status de animes em lançamento (Airing).

⚡ Filtros e Ordenação Avançada:

Filtre por status de lançamento (Em Lançamento, Finalizado) e status pessoal (Vistos, Não Vistos, Todos).

Ordenação instantânea por ordem alfabética (A-Z), nota e data de estreia (novos/antigos).

Filtros por múltiplos gêneros com opção de controle de conteúdo (+18 / NSFW).

📊 Estatísticas Detalhadas: Acompanhe métricas de progresso e a distribuição de animes assistidos por gênero através de um menu horizontal deslizante.

💾 Backup & Restauração Inteligente:

Exporte e importe seus dados em .json em plataformas móveis e web.

Resolução de conflitos em lote ou manual para manter a integridade do seu progresso.

🌗 Interface Moderna: Suporte completo a Modo Escuro com paleta customizada em tons azul marinho profundo e texto de alto contraste.

🚀 Novidades da Versão (v2.4.6)

🔄 Sincronização Contextual Inteligente:

Refresh Individual: Ao abrir a página de detalhes de um anime específico, o botão atualiza exclusivamente os dados e a sinopse daquele título instantaneamente, sem sobrecarregar a API.

Refresh Global: Na tela de favoritos ou menu, a sincronização roda para a biblioteca completa em fila ordenada.

📊 Barra de Progresso com Cancelamento: Adicionado modal/indicador de progresso em tempo real durante a sincronização em lote, exibindo a contagem de itens atualizados, anime atual e botão para Interromper/Parar o processo a qualquer momento.

🎭 Estatísticas por Gênero no Menu: Substituição da listagem estática por um carrossel deslizante interativo mostrando exatamente quantos animes assistidos você tem em cada gênero (Ação, Romance, Isekai, etc.) sem poluir o visual.

⚡ Correções de Sinopse e Desempenho: Carregamento aprimorado de sinopses e eliminação de gargalos com limites de taxa (rate-limit / HTTP 429).

📲 Como Baixar e Instalar (Android)

Para instalar a versão mais recente (v2.4.6) no seu smartphone Android:

Acesse a aba Releases no repositório.

Baixe o arquivo binário Buscanime.apk.

Abra o arquivo no dispositivo e confirme a instalação.

Nota: Caso solicitado, permita a instalação a partir de "Fontes Desconhecidas" nas configurações do Android.

🛠️ Tecnologias Utilizadas

React Native com Expo (SDK 54)

Expo Router (Navegação estruturada por rotas)

AsyncStorage (Armazenamento offline do usuário)

Jikan API & AniList API

EAS Build (Geração remota de binários APK)

Desenvolvido por Gabriel de Sassarrão Moraes Ramos.