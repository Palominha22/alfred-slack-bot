const axios = require('axios');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// Configuração baseada nos resultados do teste
const CONFIG = {
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN,
    channelId: process.env.CHANNEL_ID,
    // Mapeamento de gestores para seus respectivos negócios
    gestores: [
      {
        userId: 'UKJNGM8DR', // ID da primeira gestora
        nome: 'Erick',
        negocio: 'CX Consumer'
      },
      {
        userId: 'U07JRJHUVG8', // ID da segunda gestora
        nome: 'Gestora DX', // Substitua pelo nome correto
        negocio: 'DX'
      }
      // Adicione mais gestores conforme necessário
    ]
  },
  googleSheets: {
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: "Base Abril!A1:Z1000"
  },
  imagem: {
    url: 'https://i.postimg.cc/rFD1KRC4/Capa-Colmeia-4.png'
  }
};

// Inicializar a API do Google Sheets
async function initializeGoogleSheets() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: 'credentials.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });
    
    const client = await auth.getClient();
    return google.sheets({ version: 'v4', auth: client });
  } catch (error) {
    console.error('Erro ao inicializar Google Sheets API:', error.message);
    throw error;
  }
}

// Função auxiliar para converter string de percentual para número
function percentToNumber(percentStr) {
  if (!percentStr) return 0;
  // Lidar com formatos como "64,00%" ou "64.00%" 
  return parseFloat(percentStr.replace('%', '').replace(',', '.')) / 100;
}

// Ler dados da planilha
async function readSheetData() {
  try {
    console.log('Lendo dados da planilha...');
    const sheets = await initializeGoogleSheets();
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.googleSheets.spreadsheetId,
      range: CONFIG.googleSheets.range
    });
    
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      throw new Error('Nenhum dado encontrado na planilha');
    }
    
    // Converter os dados em um array de objetos
    const headers = rows[0];
    const data = rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = row[i] || '';
      });
      return obj;
    });
    
    console.log(`Lidos ${data.length} registros da planilha`);
    return data;
  } catch (error) {
    console.error('Erro ao ler dados da planilha:', error.message);
    throw error;
  }
}

// Processar os dados para o diagnóstico de um negócio específico
function processData(data, filtroNegocio = null) {
  try {
    console.log(`Processando dados para diagnóstico${filtroNegocio ? ' do negócio: ' + filtroNegocio : ''}...`);
    
    // Filtrar dados por negócio, se especificado
    const dadosFiltrados = filtroNegocio 
      ? data.filter(row => row.negocio === filtroNegocio)
      : data;
    
    if (filtroNegocio && dadosFiltrados.length === 0) {
      console.log(`Nenhum dado encontrado para o negócio: ${filtroNegocio}`);
      return null;
    }
    
    // Agrupar por negócio
    const negocios = {};
    dadosFiltrados.forEach(row => {
      const negocio = row.negocio || 'Não especificado';
      if (!negocios[negocio]) {
        negocios[negocio] = [];
      }
      negocios[negocio].push(row);
    });
    
    // Agrupar por campanha
    const campanhas = {};
    dadosFiltrados.forEach(row => {
      const campanha = row.campanha || 'Não especificada';
      if (!campanhas[campanha]) {
        campanhas[campanha] = [];
      }
      campanhas[campanha].push(row);
    });
    
    // Contadores para quadrantes
    const quadrantes = { 
      Q1: 0, 
      Q2: 0, 
      Q3: 0, 
      Q4: 0, 
      'Sem quadrante': 0 
    };
    
    // Contar analistas por quadrante
    dadosFiltrados.forEach(row => {
      if (row.quadrante && quadrantes[row.quadrante] !== undefined) {
        quadrantes[row.quadrante]++;
      } else {
        quadrantes['Sem quadrante']++;
      }
    });
    
    // Calcular métricas gerais
    let somaCsatGeral = 0;
    let somaAderenciaGeral = 0;
    let contadorCsatGeral = 0;
    let contadorAderenciaGeral = 0;
    let semMonitoria = 0;
    let semCSAT = 0;
    
    dadosFiltrados.forEach(row => {
      // Converter os valores de string para números
      const percCsat = percentToNumber(row.perc_csat);
      const percAderencia = percentToNumber(row.perc_aderencia);
      
      // Somar para médias gerais
      if (row.perc_csat && percCsat > 0) {
        somaCsatGeral += percCsat * 100;
        contadorCsatGeral++;
      } else {
        semCSAT++;
      }
      
      if (row.perc_aderencia && percAderencia > 0) {
        somaAderenciaGeral += percAderencia * 100;
        contadorAderenciaGeral++;
      } else {
        semMonitoria++;
      }
    });
    
    const mediaCsatGeral = contadorCsatGeral > 0 ? somaCsatGeral / contadorCsatGeral : 0;
    const mediaAderenciaGeral = contadorAderenciaGeral > 0 ? somaAderenciaGeral / contadorAderenciaGeral : 0;
    
    // Calcular métricas por negócio
    const metricasPorNegocio = Object.keys(negocios).map(negocio => {
      const rows = negocios[negocio];
      return {
        negocio,
        avaliados: rows.length,
        total: rows.length
      };
    }).sort((a, b) => b.total - a.total);
    
    // Calcular métricas por campanha
    const metricasPorCampanha = Object.keys(campanhas).map(campanha => {
      const rows = campanhas[campanha];
      
      // Calcular a quantidade de analistas em cada quadrante por campanha
      const quadrantesCampanha = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
      rows.forEach(row => {
        if (row.quadrante && quadrantesCampanha[row.quadrante] !== undefined) {
          quadrantesCampanha[row.quadrante]++;
        }
      });
      
      // Calcular totais de promotores e detratores
      const promotores = rows.reduce((sum, row) => sum + parseInt(row.csat_qtd_promotor || 0), 0);
      const detratores = rows.reduce((sum, row) => sum + parseInt(row.csat_qtd_detrator || 0), 0);
      
      // Calcular médias de CSAT e Aderência
      let somaCsat = 0, somaAderencia = 0;
      let contadorCsat = 0, contadorAderencia = 0;
      
      rows.forEach(row => {
        if (row.perc_csat) {
          const csat = percentToNumber(row.perc_csat);
          if (csat > 0) {
            somaCsat += csat * 100;
            contadorCsat++;
          }
        }
        
        if (row.perc_aderencia) {
          const aderencia = percentToNumber(row.perc_aderencia);
          if (aderencia > 0) {
            somaAderencia += aderencia * 100;
            contadorAderencia++;
          }
        }
      });
      
      const mediaCsat = contadorCsat > 0 ? somaCsat / contadorCsat : 0;
      const mediaAderencia = contadorAderencia > 0 ? somaAderencia / contadorAderencia : 0;
      
      return {
        campanha,
        promotores,
        detratores,
        mediaCsat: mediaCsat.toFixed(1),
        mediaAderencia: mediaAderencia.toFixed(1),
        total: rows.length,
        quadrantes: quadrantesCampanha,
        percQ3: ((quadrantesCampanha.Q3 / Math.max(1, rows.length)) * 100).toFixed(0),
        percQ4: ((quadrantesCampanha.Q4 / Math.max(1, rows.length)) * 100).toFixed(0)
      };
    });
    
    // Identificar campanhas ofensoras
    // Q3: Abaixo da média de CSAT mas com boa aderência
    const campanhasQ3 = metricasPorCampanha
      .filter(c => parseFloat(c.mediaCsat) < mediaCsatGeral && 
                  parseFloat(c.mediaAderencia) >= mediaAderenciaGeral &&
                  c.total >= 3) // Pelo menos 3 analistas
      .sort((a, b) => parseInt(b.percQ3) - parseInt(a.percQ3));
    
    // Q4: Abaixo da média tanto em CSAT quanto em aderência
    const campanhasQ4 = metricasPorCampanha
      .filter(c => parseFloat(c.mediaCsat) < mediaCsatGeral && 
                  parseFloat(c.mediaAderencia) < mediaAderenciaGeral &&
                  c.total >= 3) // Pelo menos 3 analistas
      .sort((a, b) => parseInt(b.percQ4) - parseInt(a.percQ4));
    
    return {
      metricasPorNegocio,
      metricasPorCampanha,
      mediaCsatGeral: mediaCsatGeral.toFixed(1),
      mediaAderenciaGeral: mediaAderenciaGeral.toFixed(1),
      totalAnalistas: dadosFiltrados.length,
      quadrantes,
      campanhasQ3,
      campanhasQ4,
      semMonitoria,
      semCSAT,
      negocioAtual: filtroNegocio || 'Todos'
    };
  } catch (error) {
    console.error('Erro ao processar dados:', error.message);
    throw error;
  }
}

// Gerar texto do diagnóstico
function gerarTextoDiagnostico(resultados, nomeGestor) {
  const dataAtual = new Date();
  const dataCorte = `${dataAtual.getDate().toString().padStart(2, '0')}/${(dataAtual.getMonth() + 1).toString().padStart(2, '0')}/${dataAtual.getFullYear()}`;
  
  // Calcular percentual de analistas nos quadrantes Q1 e Q2
  const totalQ1Q2 = resultados.quadrantes.Q1 + resultados.quadrantes.Q2;
  const percQ1Q2 = Math.round((totalQ1Q2 / resultados.totalAnalistas) * 100);
  
  // Texto do diagnóstico
  let texto = `Olá ${nomeGestor},

*PAINEL ESTRATÉGICO - ELOS (${resultados.negocioAtual})* 📢

:rolled_up_newspaper: *RECADOS IMPORTANTES:*
Devido a ausência de metas de CSAT a nível de células, estamos utilizando as metas do mês anterior.

Com a data de corte em ${dataCorte}, temos a seguinte visão geral para *${resultados.negocioAtual}*:

*Distribuição dos analistas nos quadrantes:*
• Q1: ${resultados.quadrantes.Q1} analistas
• Q2: ${resultados.quadrantes.Q2} analistas
• Q3: ${resultados.quadrantes.Q3} analistas
• Q4: ${resultados.quadrantes.Q4} analistas

:warning: *PONTOS DE ATENÇÃO* :warning:
Neste recorte, temos um total de ${resultados.totalAnalistas} analistas distribuídos entre Q1 a Q4, ${resultados.semMonitoria} analistas estão sem monitoria e ${resultados.semCSAT} estão sem CSAT :exclamation:

:chart_with_upwards_trend: O total de analistas nos quadrantes Q1 e Q2 é de ${percQ1Q2}%. ${percQ1Q2 >= 30 ? ':white_check_mark:' : ''}

:dart: A aderência geral está em ${resultados.mediaAderenciaGeral}%, com um CSAT médio de ${resultados.mediaCsatGeral}%.`;

  // Adicionar campanhas ofensoras se houver
  if (resultados.campanhasQ3.length > 0) {
    texto += `\n\n:warning: *Frentes Ofensoras - % de Analistas (Q3)* :warning:
${resultados.campanhasQ3.slice(0, 3).map(c => `${c.campanha} - ${c.total} analistas (${c.percQ3}%)`).join('\n')}`;
  }
  
  if (resultados.campanhasQ4.length > 0) {
    texto += `\n\n:warning: *Frentes Ofensoras - % de Analistas (Q4)* :warning:
${resultados.campanhasQ4.slice(0, 3).map(c => `${c.campanha} - ${c.total} analistas (${c.percQ4}%)`).join('\n')}`;
  }

  // Adicionar principais campanhas se houver
  if (resultados.metricasPorCampanha.length > 0) {
    texto += `\n\n*Campanhas de ${resultados.negocioAtual}:*
${resultados.metricasPorCampanha.slice(0, 5).map(c => `${c.campanha}: ${c.total} analistas (CSAT: ${c.mediaCsat}%, Aderência: ${c.mediaAderencia}%)`).join('\n')}`;
  }
  
  return texto;
}

// Enviar diagnóstico estratégico para o Slack
async function enviarDiagnostico() {
  try {
    console.log('Iniciando geração do diagnóstico estratégico...');
    
    // Ler dados da planilha
    const dadosPlanilha = await readSheetData();
    
    // Para cada gestor, processar e enviar seu relatório específico
    for (const gestor of CONFIG.slack.gestores) {
      console.log(`Processando diagnóstico para o gestor ${gestor.nome} (${gestor.negocio})...`);
      
      // Processar dados específicos para o negócio deste gestor
      const resultados = processData(dadosPlanilha, gestor.negocio);
      
      // Se não houver dados para este negócio, pular para o próximo gestor
      if (!resultados) {
        console.log(`Sem dados para o negócio ${gestor.negocio}, pulando gestor ${gestor.nome}`);
        continue;
      }
      
      // Gerar texto do diagnóstico
      const textoDiagnostico = gerarTextoDiagnostico(resultados, gestor.nome);
      
      console.log(`Diagnóstico gerado para ${gestor.nome}, enviando para o Slack...`);
      
      // Blocos do Slack
      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `📊 Diagnóstico Estratégico - ${gestor.negocio}`,
            emoji: true
          }
        },
        {
          type: 'image',
          title: {
            type: 'plain_text',
            text: 'Análise de Performance'
          },
          image_url: CONFIG.imagem.url,
          alt_text: 'Capa do Diagnóstico'
        },
        {
          type: 'divider',
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: textoDiagnostico
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `*Resumo ${gestor.negocio}:* CSAT Médio: ${resultados.mediaCsatGeral}% | Aderência Média: ${resultados.mediaAderenciaGeral}% | Total Analistas: ${resultados.totalAnalistas}`
            }
          ]
        }
      ];
  
      console.log(`Enviando mensagem direta para ${gestor.nome}...`);
  
      // Enviar para o ID do usuário específico deste gestor
      const response = await axios.post(
        'https://slack.com/api/chat.postMessage',
        {
          channel: gestor.userId,
          text: `Diagnóstico Estratégico - ${gestor.negocio} - ${new Date().toLocaleDateString()}`,
          blocks: blocks,
          unfurl_links: false,
          unfurl_media: true,
        },
        {
          headers: {
            Authorization: `Bearer ${CONFIG.slack.botToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
  
      if (!response.data.ok) {
        console.error(`Erro da API Slack para ${gestor.nome}:`, response.data.error);
      } else {
        console.log(`Diagnóstico enviado ao Slack com sucesso para ${gestor.nome}!`);
      }
    }
    
  } catch (error) {
    console.error('Erro ao enviar diagnóstico:', error.message);
    if (error.response) {
      console.error('Detalhes da resposta:', error.response.data);
    }
  }
}

// Executar
console.log('Iniciando processo de geração e envio do diagnóstico estratégico...');
enviarDiagnostico()
  .then(() => {
    console.log('Processo concluído com sucesso');
  })
  .catch((error) => {
    console.error('Erro crítico no processo:', error);
  });
