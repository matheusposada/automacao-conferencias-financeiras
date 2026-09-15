📊 Automação de Conferências Financeiras
Aplicação web client-side desenvolvida em JavaScript para automação de conferência, conciliação e auditoria de dados financeiros e operacionais entre o sistema do App (Pedidos / Financeiro), a Planilha de Vendas e os extratos bancários adquirentes (Safra e Pix).
🚀 Funcionalidades Principais

    Upload Centralizado (Carregamento Único): Envie as 4 planilhas base uma única vez no topo da página e execute qualquer uma das 5 análises sem precisar refazer os uploads.

    Compatibilidade Híbrida de Arquivos do App: Aceita nativamente tanto a versão multi-abas (pedidos_...xlsx) quanto a versão unificada (financeiro-conferencia...xlsx).

    Tratamento Inteligente de Pedidos: Higienização e normalização automática dos identificadores de pedidos (ex: PED-2026-016077 e 16077 são reconhecidos e cruzados perfeitamente).

    Consolidação Prévia por Pedido (Pre-Grouping): Agrupa múltiplos registros, parcelas e lançamentos fracionados pertencentes ao mesmo pedido antes de validar contra os extratos bancários.

    Busca Híbrida Múltipla (Safra + Pix): Suporte a pagamentos combinados (Cartão + Pix, Boleto + Pix, etc.) ou múltiplos NSUs cadastrados na mesma célula separados por vírgula, barra ou espaço.

    Interface Dinâmica e Exportação: Visualização tabular com filtros por status (OK, Divergente/Duplicado, Pendente/Não Encontrado), busca textual instantânea e exportação dos resultados em .xlsx.

🛠️ Tecnologias Utilizadas

    HTML5 / CSS3: Interface responsiva com sistema de abas, drag & drop e sinalização por badges/pills de status.

    JavaScript (ES6+ Async/Await): Motor de processamento executado inteiramente no navegador (garantindo privacidade total dos dados).

    SheetJS (XLSX v0.18.5): Lib externa para parsing e geração dinâmica de planilhas Excel (.xlsx, .xls, .csv).

📂 Estrutura do Projeto
Plaintext

├── index.html       # Estrutura visual, formulários de upload e painéis de navegação
├── script.js        # Lógica central, algoritmos de normalização e cruzamento de dados
└── style.css        # Estilização, temas visuais e formatação das tabelas de auditoria

🔍 Regras de Negócio e Análises Suportadas
1. Duplicidades de NSU (App)

    Objetivo: Identificar se algum NSU de cartão/Pix foi inserido mais de uma vez para pedidos ou clientes distintos.

    Mapeamento de Data:

        No modelo pedidos_...: Lê a Coluna D (Data Verificação).

        No modelo financeiro-conferencia...: Lê a Coluna E (Data Financeiro Aguardando).

2. Consultores (App × Vendas)

    Objetivo: Validar se o responsável/vendedor registrado no App coincide com a coluna Consultor da planilha de Vendas.

    Mapeamento: Cruza Vendedor (Omie) ou Vendedor contra Consultor.

3. Pedidos / Datas (App × Vendas)

    Objetivo: Verificar a consistência das datas operacionais.

    Mapeamento: Compara a Data da Coluna A (DATA) da planilha de Vendas contra:

        Coluna D (Data Verificação) se o arquivo for pedidos_...

        Coluna E (Data Financeiro Aguardando) se o arquivo for financeiro-conferencia...

4. Valores (App × Vendas)

    Objetivo: Identificar divergências nos totais faturados por pedido.

    Mapeamento: Compara o Valor Total a Pagar / Valor Total do Pedido (R$) do App contra a coluna VALOR / Valor Líquido de Vendas.

5. Pagamentos e Reconciliação (App × Safra / Pix)

    Objetivo: Confirmar se o valor do pedido no App foi devidamente liquidado nos extratos do Safra e/ou Pix.

    Destaques da Lógica:

        Agrupa todas as parcelas do pedido.

        Trata NSUs múltiplos na mesma célula.

        Reconcilia transações fracionadas e identifica pagamentos parciais (ex: Pagamento Parcial (1/2 NSUs)).

        Limpa sufixos decimais e normaliza zeros à esquerda.

📋 Como Utilizar

    Abra o arquivo index.html em qualquer navegador moderno (Chrome, Edge, Firefox, Safari).

    Na seção 1. Carregar Arquivos Base, faça o upload das planilhas desejadas:

        Planilha do App: pedidos_...xlsx ou financeiro-conferencia...xlsx

        Planilha de Vendas: Vendas.xlsx

        Extrato Safra: TRANSAÇÕES_....csv

        Extrato Pix: pix.xlsx

    Na seção 2. Selecionar Análise, navegue pelas abas e clique no botão ▶ Rodar ....

    Visualize os resultados na tabela, utilize a barra de pesquisa ou os botões de filtro (Só Divergentes, Só Pendentes, etc.).

    Clique em 📥 Exportar (.xlsx) para baixar o relatório final auditado.

🔒 Privacidade e Segurança

Por ser uma aplicação totalmente front-end, nenhum dado ou planilha é enviado para servidores externos. Todo o processamento de leitura, parsing, agrupamento e comparação ocorre localmente na memória do seu próprio navegador.