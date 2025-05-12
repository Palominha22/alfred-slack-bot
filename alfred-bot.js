const axios = require('axios');
require('dotenv').config();

// Dados do Slack
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_CHANNEL_ID = 'C08P4TE2WCV';

if (!SLACK_BOT_TOKEN) {
  console.error('Erro: SLACK_BOT_TOKEN não está definido no arquivo .env');
  process.exit(1);
}

console.log('Iniciando envio de mensagem para o canal:', SLACK_CHANNEL_ID);

// Enviar mensagem para o Slack com imagem pública
async function sendToSlack() {
  try {
    // URL pública da imagem (não precisa baixar nem fazer upload)
    const imageUrl = 'https://i.postimg.cc/rFD1KRC4/Capa-Colmeia-4.png';
    
    console.log('Enviando mensagem para o Slack com imagem pública...');

    // Estrutura de blocos usando a URL pública da imagem
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📊 Diagnóstico Estratégico',
          emoji: true
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Aqui está o diagnóstico estratégico com os dados mais recentes.'
          }
        ]
      },
      {
        type: 'image', // Bloco independente para imagem
        title: {
          type: 'plain_text',
          text: 'Análise Estratégica'
        },
        image_url: imageUrl, // URL pública da imagem
        alt_text: 'Capa do Diagnóstico'
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Aqui estão os insights das campanhas com base no desempenho dos nossos negócios:'
        }
      }
    ];

    const response = await axios.post(
      'https://slack.com/api/chat.postMessage',
      {
        channel: SLACK_CHANNEL_ID,
        text: 'Diagnóstico Estratégico',
        blocks: blocks,
        unfurl_links: false,
        unfurl_media: true,
      },
      {
        headers: {
          Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Resposta da API Slack:', JSON.stringify(response.data, null, 2));

    if (!response.data.ok) {
      console.error('Erro da API Slack:', response.data.error);
    } else {
      console.log('Mensagem enviada ao Slack com sucesso!');
    }
  } catch (error) {
    console.error('Erro ao enviar mensagem ao Slack:', error.message);
    if (error.response) {
      console.error('Detalhes da resposta:', error.response.data);
    }
  }
}

// Executar
console.log('Iniciando processo de envio...');
sendToSlack()
  .then(() => {
    console.log('Processo de envio concluído');
  })
  .catch((error) => {
    console.error('Erro crítico no processo:', error);
  });
