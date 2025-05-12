const { google } = require('googleapis');
require('dotenv').config();

// Configurações que serão usadas no código principal
const CONFIG = {
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN,
    channelId: process.env.CHANNEL_ID,
    gestorNome: 'Erick'
  },
  googleSheets: {
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Base Abril!A1:Z1000' // Aba específica "Base Abril"
  },
  imagem: {
    url: 'https://i.postimg.cc/rFD1KRC4/Capa-Colmeia-4.png'
  }
};

async function testarConexao() {
  try {
    console.log("=== TESTE DE CONFIGURAÇÃO DO BOT DE DIAGNÓSTICO ===");
    console.log("ID da planilha:", process.env.GOOGLE_SHEET_ID);
    
    // Arquivo de credenciais
    const keyFile = 'credentials.json';
    console.log("Usando arquivo de credenciais:", keyFile);

    // Configurar autenticação
    const auth = new google.auth.GoogleAuth({
      keyFile: keyFile,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });
    
    const client = await auth.getClient();
    console.log("Cliente autenticado com sucesso");
    
    // Mostra o email da conta de serviço (para confirmar)
    const email = await auth.getCredentials().then(creds => creds.client_email);
    console.log("Conta de serviço:", email);
    
    const sheets = google.sheets({ version: 'v4', auth: client });
    
    // Obter informações sobre a planilha
    const sheetInfo = await sheets.spreadsheets.get({
      spreadsheetId: CONFIG.googleSheets.spreadsheetId
    });

    console.log("\n📊 Abas disponíveis na planilha:");
    sheetInfo.data.sheets.forEach(sheet => {
      console.log(`- ${sheet.properties.title} (gid=${sheet.properties.sheetId})`);
    });
    
    // Verificar se a aba "Base Abril" existe
    const abaBaseAbril = sheetInfo.data.sheets.find(sheet => 
      sheet.properties.title === 'Base Abril'
    );
    
    if (!abaBaseAbril) {
      console.error("\n⚠️ ALERTA: A aba 'Base Abril' não foi encontrada. Verificando a primeira aba disponível.");
      CONFIG.googleSheets.range = `${sheetInfo.data.sheets[0].properties.title}!A1:Z1000`;
    }
    
    console.log(`\n🔍 Testando leitura de dados da aba: ${CONFIG.googleSheets.range.split('!')[0]}`);
    
    // Ler dados com mais colunas para analisar
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.googleSheets.spreadsheetId,
      range: CONFIG.googleSheets.range.split('!')[0] + '!A1:Z10' // Ler mais colunas
    });
    
    if (!response.data.values || response.data.values.length === 0) {
      console.error("\n❌ Erro: Nenhum dado encontrado na planilha!");
      return;
    }
    
    console.log(`\n✅ Dados encontrados - Total de ${response.data.values.length} linhas`);
    
    // Analisar cabeçalhos
    const headers = response.data.values[0].map(h => h.toLowerCase().trim());
    console.log("\n📋 Cabeçalhos das colunas:");
    console.table(headers);
    
    // Verificar campos necessários para o diagnóstico
    const camposNecessarios = [
      'negocio', 'campanha', 
      'csat', 'perc_csat', 'aderencia', 'perc_aderencia',
      'avaliado', 'quadrante', 'promotor', 'detrator'
    ];
    
    console.log("\n🔍 Verificando campos necessários para o diagnóstico:");
    
    const camposEncontrados = camposNecessarios.map(campo => {
      const encontrado = headers.some(h => 
        h.includes(campo) || 
        (campo === 'csat' && h.includes('satisfacao')) ||
        (campo === 'aderencia' && h.includes('adere'))
      );
      
      return { campo, encontrado };
    });
    
    console.table(camposEncontrados);
    
    // Mostrar primeiras linhas de dados
    console.log("\n📊 Primeiras linhas de dados:");
    for (let i = 1; i < Math.min(5, response.data.values.length); i++) {
      const row = response.data.values[i];
      const rowData = {};
      
      // Mapear os valores para seus cabeçalhos
      headers.forEach((header, index) => {
        if (index < row.length) {
          rowData[header] = row[index];
        }
      });
      
      console.log(`\n--- Linha ${i} ---`);
      console.table(rowData);
    }
    
    console.log("\n✅ Teste de configuração concluído com sucesso!");
    console.log("\n🚀 Use esta configuração no seu arquivo alfred-bot.js:");
    console.log("const CONFIG = " + JSON.stringify(CONFIG, null, 2));
    
  } catch (error) {
    console.error("\n❌ Erro ao conectar com Google Sheets:", error.message);
    console.error("Stack trace:", error.stack);
    if (error.response) {
      console.error("Detalhes da resposta:", error.response.data);
    }
  }
}

testarConexao();
