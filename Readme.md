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
├── js/
│   ├── core/        # Núcleo: state.js (arquivos/calendários), utils.js (normalização e leitura), ui.js (abas, uploads, tabela padrão), router.js (botões)
│   └── analises/    # Uma análise por arquivo (01 a 12); a 9 tem o motor de cálculo em 09-indicadores-motor.js
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

9. Indicadores Financeiros (Relatório Semanal)

    Objetivo: Gerar o relatório semanal do financeiro (mesmo formato da apresentação) a partir da planilha financeiro-conferencia.

    Arquivos: App (financeiro-conferencia) obrigatório. Relatório de Pedidos opcional (habilita Cancelamentos com "Cancelado por" e Masterclass).

    Filtros: entrada no financeiro = "Data Financeiro Aguardando". Ficam de fora os status Aprovação gerencial / SAC, Análise de crédito, Crédito reprovado, Efetivado, Orçamento, Rejeitado, Retroativo e Cancelado (cancelados só entram na análise de cancelamentos). Um registro por pedido (recebimentos múltiplos são consolidados).

    Status no fechamento do período: reconstruído pelas datas. Confirmado = tem "Data Financeiro Confirmado" até o fim do período (inclui Aguardando cadastro, Em faturamento e Faturado); Verificado = link enviado, sem confirmação; Pendente = sem verificação.

    Tempos: envio do link = entrada → verificação; confirmação = verificação → confirmação. Pedidos sem verificação (boleto, bonificado e PIX já pago) são confirmados direto e ficam fora das médias do link.

    Matriz de verificação: até 5 min, 5–15, 15–30, 30–60 min, 1–4 h, acima de 4 h (mesmo dia), e depois dias de calendário (24 h, 48 h, 72 h, 96 h).

    Matriz de confirmação: 0–4 h, 4–12, 12–24, 24–48, 48–72 e acima de 72 h, contadas do início do dia de entrada. Pedidos com PIX confirmados direto (já pagos na chegada) entram em 0–4 h.

    Sábado: pedidos que entraram, pagos no próprio sábado (data do NSU = data de entrada) e confirmados, com a média dos sábados anteriores.

    SLA de pagamento: prazo de 5 dias; lista os pedidos em aberto vencidos (por faixa de dias e semana de entrada) e os pagos fora do prazo. Depende de a planilha ter entradas desde o início do período (ideal: desde 01/09).

    Cancelamentos e Masterclass: usam o Relatório de Pedidos (categoria, "Cancelado por", valor; evento pelo nome, ex.: "4 Pilares").

    Saídas: tela, relatório em Markdown (botão de copiar, para o Gamma) e planilha .xlsx (Resumo, Pedidos da semana, SLA, Cancelamentos, Masterclass, Notas).

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