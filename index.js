const fs = require('fs');
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, REST, Routes, PermissionFlagsBits, ChannelType, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');
require('dotenv').config();

// IDs do Discord: altere os valores deste bloco quando trocar canais ou cargos.
const CONTRACT_GUILD_ID = '1491080801662533878';
const FREE_AGENT_ROLE_ID = '1541621757062942800';

const ALLOWED_FA_CHANNELS = ['1537994513203728435'];
const FA_ANNOUNCEMENT_CHANNEL = '1537996715901329541';
const ALLOWED_CONTRACT_CHANNELS = ['1537994513203728435'];
const CONTRACT_ANNOUNCEMENT_CHANNEL = '1537996820339228702';
const ALLOWED_SCOUTING_CHANNELS = ['1537994513203728435'];
const SCOUTING_ANNOUNCEMENT_CHANNEL = '1537996900522004550';
const ALLOWED_RELEASE_CHANNELS = ['1537994513203728435'];
const RELEASE_ANNOUNCEMENT_CHANNEL = '1541932051979173888';
const ALLOWED_ANNOUNCE_ROLES = [
  '1538001489883299970',
  '1541112865384169623',
  '1538007403763605525',
  '1538007538426052648',
  '1538009011662753832',
  '1538008873036677291',
  '1538008253261422632',
  '1538008124038840440',
  '1541614758007144458',
];

// Evita que erros não tratados derrubem o bot
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
  ]
});

// Evita que erros do cliente (como Rate Limits da API) derrubem o bot
client.on('error', error => {
  console.error('Discord client error:', error);
});

const REACTION_MESSAGE_ID = '1499060132145795233';

const ALLOWED_COMMAND_ROLES = [
  '1538012495229493292',
  '1538202674829328554'
];

const ALLOWED_TEAM_ROLES = [
  '1538029232259735552',
  '1538029362706784266',
  '1538029520358219796',
  '1538029641325875330',
  '1538029841192845372',
  '1538029936852598904',
  '1538030063914590238',
  '1538030155560263710',
  '1538030232978853909',
  '1538030296547594260',
  '1538030358854107197',
  '1538030456413622333',
  '1538030592107745320',
  '1538030678350757918',
  '1538030774056386561',
  '1538030845200175114'
];

const ALLOWED_TEAM_ROLE_NAMES = [];
const ROSTER_CAP = 14;

const CONTRACT_EXPIRATION_TIME = 24 * 60 * 60 * 1000;

const REACTION_ROLES_CHANNEL = '1492347556053778432';

const REACTION_ROLES = [
  { emoji: '⚙️', roleId: '1492348332700471458', label: 'Scrim Ping',  description: 'Quer ser notificado quando estiver tendo scrim?' },
  { emoji: '🎉', roleId: '1492348735437668472', label: 'Fun Ping',    description: 'Quer ser notificado sobre eventos e diversão?' },
  { emoji: '⚽', roleId: '1492348557812961422', label: 'Match Ping',  description: 'Quer ser notificado quando estiver acontecendo uma partida?' },
  { emoji: '📸', roleId: '1492348457015578736', label: 'Media Ping',  description: 'Quer ter acesso a toda categoria de media?' },
];

const REACTION_MSG_FILE = './reaction_message.json';

const PING_INTERVAL_FILE = './last_ping.json';
const PING_INTERVAL = 2 * 24 * 60 * 60 * 1000;

let reactionMessageId = null;
let pingIntervalTimer = null;

// ═══════════════════════════════════════════════════
// 🎮 SISTEMA DE SCRIM
// ═══════════════════════════════════════════════════

// Canal fixo para anúncios de scrim
const SCRIM_CHANNEL = '1491439536545202216';
// Cargo necessário para usar o comando /scrim
const SCRIM_HOSTER_ROLES = [
    '1491442295898243072',
    '1492271517508178081',
    '1492271438068191262',
    '1492271212078829698',
    '1492271160333959278'
];
// Cargo mencionado quando ping_scrim = true
const SCRIM_PING_ROLE = '1492348332700471458';

// Armazena os dados de cada mensagem de scrim: messageId -> { link, requisitos, host, formato, channelId }
const scrimData = new Map();
// Evita envio duplicado do link
const scrimLinkSent = new Set();

// ═══════════════════════════════════════════════════
// 🪟 SISTEMA DE JANELA DE TRANSFERÊNCIAS
// ═══════════════════════════════════════════════════

const TRANSFER_WINDOW_FILE = './transfer_window.json';

let transferWindow = {
  clubs: false,
  freeAgent: true  // ← ADICIONAR
};

function saveTransferWindow() {
  fs.writeFileSync(TRANSFER_WINDOW_FILE, JSON.stringify(transferWindow, null, 2));
}

function loadTransferWindow() {
  if (!fs.existsSync(TRANSFER_WINDOW_FILE)) {
    saveTransferWindow();
    return;
  }
  try {
    const data = JSON.parse(fs.readFileSync(TRANSFER_WINDOW_FILE, 'utf8'));
    transferWindow.clubs = data.clubs ?? false;
    transferWindow.freeAgent = data.freeAgent ?? true;  // ← ADICIONAR
    console.log(`📂 Janelas carregadas — Clubs: ${transferWindow.clubs ? '🟢 Aberta' : '🔴 Fechada'} | Free Agent: ${transferWindow.freeAgent ? '🟢 Aberta' : '🔴 Fechada'}`);
  } catch (err) {
    console.error('Erro ao carregar transfer window:', err);
    saveTransferWindow();
  }
}

function buildTransferWindowEmbed() {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🪟 Janela de Transferências')
    .setDescription('Selecione qual janela deseja **abrir** ou **fechar**:')
    .addFields(
      {
        name: '🏟️ Clubs',
        value: transferWindow.clubs ? '🟢 **Aberta** — Clubes podem contratar jogadores' : '🔴 **Fechada** — Clubes não podem contratar jogadores',
        inline: false
      },
      {
        name: '🟡 Free Agent',  // ← CAMPO NOVO
        value: transferWindow.freeAgent ? '🟢 **Aberta** — Jogadores podem se anunciar como FA' : '🔴 **Fechada** — Jogadores não podem se anunciar como FA',
        inline: false
      }
    )
    .setFooter({ text: 'The Classic Football League • Apenas Administradores' })
    .setTimestamp();
}

function buildTransferWindowSelectMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('transfer_window_select')
      .setPlaceholder('Escolha qual janela deseja alternar...')
      .addOptions([
        {
          label: `Clubs — ${transferWindow.clubs ? 'Fechar' : 'Abrir'}`,
          value: 'clubs',
          description: transferWindow.clubs ? 'Fechar janela de clubes' : 'Abrir janela de clubes',
          emoji: '🏟️'
        },
        {
          label: `Free Agent — ${transferWindow.freeAgent ? 'Fechar' : 'Abrir'}`,  // ← OPÇÃO NOVA
          value: 'freeAgent',
          description: transferWindow.freeAgent ? 'Fechar anúncios de Free Agent' : 'Abrir anúncios de Free Agent',
          emoji: '🟡'
        }
      ])
  );
}

// ═══════════════════════════════════════════════════
// 🎫 SISTEMA DE AUTO-RESPOSTA EM TICKETS
// ═══════════════════════════════════════════════════

const TICKET_AUTO_RESPONSES = [
  {
    keywords: ['ownar', 'quero ownar', 'como ownar'],
    embed: {
      title: '👑 Como Ownar um Time',
      description:
        `Para ownar um time na **The Classic Football League**, siga os passos:\n\n` +
        `1️⃣ Monte sua **squad (squadsheet)**\n` +
        `2️⃣ Envie sua squadsheet neste ticket\n` +
        `3️⃣ Aguarde a análise da staff\n\n` +
        `⚠️ Apenas squads organizadas serão aceitas.\n\n` +
        `📌 Um staff irá te responder em breve.`,
      color: 0xf1c40f
    }
  },
  {
    keywords: ['parceria', 'partner', 'parceiro'],
    embed: {
      title: '🤝 Parceria',
      description:
        `Para fazer uma parceria com a liga:\n\n` +
        `📌 Envie as seguintes informações:\n` +
        `• Link de convite\n` +
        `• Quantidade de membros\n` +
        `⏳ Aguarde um staff analisar seu pedido.`,
      color: 0x3498db
    }
  },
  {
    keywords: ['suporte', 'ajuda', 'help', 'denuncia'],
    embed: {
      title: '🆘 Suporte',
      description:
        `Explique seu problema com o máximo de detalhes possível.\n\n` +
        `📌 Um membro da staff irá te ajudar em breve.\n\n` +
        `⏳ Aguarde...`,
      color: 0xe74c3c
    }
  }
];

// ═══════════════════════════════════════════════════
// 🎫 MENSAGEM DE BOAS-VINDAS AO ABRIR TICKET
// ═══════════════════════════════════════════════════

async function sendTicketWelcome(channel, user) {
  const welcomeEmbed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🎫 Ticket Aberto')
    .setDescription(
      `Olá ${user}! Seja bem-vindo ao suporte da **The Classic Football League**.\n\n` +
      `Escolha uma opção abaixo digitando:\n\n` +
      `👑 **Ownar** — Quero ownar um time\n` +
      `🤝 **Parceria** — Quero fazer parceria\n` +
      `🆘 **Suporte** — Preciso de ajuda\n\n` +
      `Ou explique diretamente seu problema que um staff irá te atender.`
    )
    .setFooter({ text: 'The Classic Football League • Responderemos em breve!' })
    .setTimestamp();

  try {
    await channel.send({ embeds: [welcomeEmbed] });
  } catch (err) {
    console.error('❌ Erro ao enviar mensagem de boas-vindas do ticket:', err);
  }
}

function saveLastPingTime() {
  fs.writeFileSync(PING_INTERVAL_FILE, JSON.stringify({ lastPing: Date.now() }));
}

function loadLastPingTime() {
  if (!fs.existsSync(PING_INTERVAL_FILE)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(PING_INTERVAL_FILE, 'utf8'));
    return data.lastPing || null;
  } catch {
    return null;
  }
}

async function sendHerePing(guild) {
  const channel = await guild.channels.fetch(REACTION_ROLES_CHANNEL).catch(() => null);
  if (!channel) {
    console.error('❌ Canal de reaction roles não encontrado para ping!');
    return;
  }

  const pingEmbed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🔔 Lembrete de Cargos por Reação')
    .setDescription(
      `Não se esqueça de reagir na mensagem de cargos para personalizar suas notificações!\n\n` +
      `Escolha os cargos que você quer receber:\n` +
      REACTION_ROLES.map(r => `${r.emoji} **${r.label}** - ${r.description}`).join('\n')
    )
    .setFooter({ text: 'The Classic Football League • Reaja na mensagem fixada acima!' })
    .setTimestamp();

  try {
    const sentMessage = await channel.send({
      content: '@here',
      embeds: [pingEmbed]
    });
    console.log('✅ Ping @here enviado no canal de reaction roles');
    saveLastPingTime();

    setTimeout(async () => {
      try {
        await sentMessage.delete();
        console.log('🗑️ Mensagem de ping @here apagada automaticamente.');
      } catch (err) {
        console.error('❌ Erro ao apagar mensagem de ping:', err);
      }
    }, 60000);

  } catch (err) {
    console.error('❌ Erro ao enviar ping @here:', err);
  }
}

function schedulePingInterval(guild) {
  const lastPing = loadLastPingTime();
  const now = Date.now();
  
  let nextPingDelay;
  
  if (lastPing) {
    const timeSinceLastPing = now - lastPing;
    if (timeSinceLastPing >= PING_INTERVAL) {
      sendHerePing(guild);
      nextPingDelay = PING_INTERVAL;
    } else {
      nextPingDelay = PING_INTERVAL - timeSinceLastPing;
    }
  } else {
    nextPingDelay = PING_INTERVAL;
  }

  console.log(`🔔 Próximo ping @here em: ${Math.round(nextPingDelay / 1000 / 60 / 60)} horas`);

  if (pingIntervalTimer) {
    clearInterval(pingIntervalTimer);
  }

  setTimeout(() => {
    sendHerePing(guild);
    pingIntervalTimer = setInterval(() => {
      sendHerePing(guild);
    }, PING_INTERVAL);
  }, nextPingDelay);
}

function saveReactionMessageId(id) {
  fs.writeFileSync(REACTION_MSG_FILE, JSON.stringify({ messageId: id }));
}

function loadReactionMessageId() {
  return REACTION_MESSAGE_ID;
}

function buildReactionRolesEmbed() {
  const lines = REACTION_ROLES.map(r => `${r.emoji} - ${r.description}`).join('\n');
  return new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle('🎭 Cargos por Reação')
    .setDescription(`Você que está no comando de quando você será mencionado\n\n${lines}`)
    .setFooter({ text: 'The Classic Football League • Reaja abaixo para receber/remover um cargo' })
    .setTimestamp();
}

async function setupReactionRolesMessage(guild) {
  const channel = await guild.channels.fetch(REACTION_ROLES_CHANNEL).catch(() => null);
  if (!channel) {
    console.error('❌ Canal de reaction roles não encontrado!');
    return;
  }

  const msg = await channel.send({
    embeds: [buildReactionRolesEmbed()],
  });

  for (const r of REACTION_ROLES) {
    await msg.react(r.emoji);
  }

  console.log(`✅ Mensagem de reaction roles criada: ${msg.id}`);
}

const INVITE_REGEX = /(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[a-zA-Z0-9]+/i;
const DIVULGACAO_REGEX = /^algu[eé]m\s+quer\s+entrar/i;
const AUTO_RESPONSES = [
  {
    keywords: [
      'como uso fa', 'como usar fa', 'como faço fa', 'como faz fa',
      'como anuncio fa', 'como ser fa', 'como postar fa', 'como manda fa',
      'onde uso fa', 'onde faço fa', 'onde fica o fa', 'cade o fa',
      'o que e fa', 'oque e fa', 'pra que serve fa', 'como funciona fa',
      'free agent como', 'como viro fa', 'quero ser fa', 'como posto fa',
      'como uso free agent', 'como usar free agent', 'como faço free agent',
      'como faz free agent', 'como anuncio free agent', 'como ser free agent',
      'como postar free agent', 'como manda free agent', 'como mando free agent',
      'onde uso free agent', 'onde faço free agent', 'cade o free agent',
      'o que e free agent', 'oque e free agent', 'pra que serve free agent',
      'como funciona free agent', 'como viro free agent', 'quero ser free agent',
      'como coloco free agent', 'como posto free agent', 'como anunciar free agent',
    ],
    response: `📢 Para se anunciar como **Free Agent**, use o comando \`/fa\` no canal <#${ALLOWED_FA_CHANNELS[0]}>!`
  },
  {
    keywords: [
      'como uso contract', 'como usar contract', 'como faço contract', 'como faz contract',
      'como envio contrato', 'como mando contrato', 'como criar contrato',
      'onde uso contract', 'onde faço contract', 'cade o contract',
      'como funciona contract', 'pra que serve contract', 'o que e contract',
      'como contratar jogador', 'como contratar alguem', 'quero contratar',
      'como propor contrato', 'como fazer contrato', 'como assinar contrato',
      'como manda contract', 'como mando contract',
    ],
    response: `📋 Para propor um **Contrato**, use o comando \`/contract\` no canal <#${ALLOWED_CONTRACT_CHANNELS[0]}>!`
  },
  {
    keywords: [
      'como uso scouting', 'como usar scouting', 'como faço scouting', 'como faz scouting',
      'como anuncio scouting', 'como postar scouting', 'onde uso scouting',
      'cade o scouting', 'como funciona scouting', 'pra que serve scouting',
      'o que e scouting', 'oque e scouting', 'quero fazer scouting',
      'como recrutar jogador', 'como procurar jogador', 'como buscar jogador',
      'como manda scouting', 'como mando scouting',
    ],
    response: `🔍 Para anunciar um **Scouting**, use o comando \`/scouting\` no canal <#${ALLOWED_SCOUTING_CHANNELS[0]}>!`
  },
  {
    keywords: [
      'como uso release', 'como usar release', 'como faço release', 'como faz release',
      'como sair do time', 'como saio do time', 'como me liberar', 'como se liberar',
      'onde uso release', 'cade o release', 'como funciona release',
      'pra que serve release', 'o que e release', 'oque e release',
      'quero sair do time', 'como deixar o time', 'como largar o time',
      'como dar release', 'quero dar release', 'quero me liberar',
      'como manda release', 'como mando release',
    ],
    response: `🔓 Para se **liberar de um time**, use o comando \`/release\` no canal <#${ALLOWED_RELEASE_CHANNELS[0]}>!`
  },
];

async function sendToChannel(guild, channelId, payload, threadName) {
  const channel = await guild.channels.fetch(channelId);
  if (!channel) return;

  if (channel.type === ChannelType.GuildForum) {
    await channel.threads.create({
      name: threadName,
      message: payload,
    });
  } else {
    await channel.send(payload);
  }
}

const pendingContracts = new Map();
const activeContracts = new Map();
const expirationTimers = new Map();

const CONTRACTS_FILE = './contratos.json';

function saveContracts() {
  const data = {};
  for (const [id, c] of activeContracts) {
    data[id] = {
      contractId: c.contractId,
      signee: { id: c.signee.id, username: c.signee.username },
      contractor: { id: c.contractor.id, username: c.contractor.username },
      teamName: c.teamName,
      teamRoleId: c.teamRoleId,
      position: c.position,
      role: c.role,
      proposedAt: c.proposedAt,
      signedAt: c.signedAt,
      expiresAt: c.expiresAt,
      channelId: c.channelId,
      guildId: c.guildId,
    };
  }
  fs.writeFileSync(CONTRACTS_FILE, JSON.stringify(data, null, 2));
}

function loadContracts() {
  if (!fs.existsSync(CONTRACTS_FILE)) return;
  try {
    const data = JSON.parse(fs.readFileSync(CONTRACTS_FILE, 'utf8'));
    const now = Date.now();
    for (const [id, c] of Object.entries(data)) {
      const expiresAt = new Date(c.expiresAt).getTime();
      if (expiresAt > now) {
        activeContracts.set(id, {
          ...c,
          signee: c.signee,
          contractor: c.contractor,
          proposedAt: new Date(c.proposedAt),
          signedAt: new Date(c.signedAt),
          expiresAt: new Date(c.expiresAt),
        });
        const remaining = expiresAt - now;
        const timer = setTimeout(async () => {
          activeContracts.delete(id);
          expirationTimers.delete(id);
          saveContracts();
          try {
            const guild = client.guilds.cache.get(c.guildId);
            if (guild) {
              const channel = guild.channels.cache.get(CONTRACT_ANNOUNCEMENT_CHANNEL);
              const member = await guild.members.fetch(c.signee.id).catch(() => null);
              if (member && c.teamRoleId) {
                await member.roles.remove(c.teamRoleId).catch(() => {});
              }
              if (member) {
                await member.roles.add(FREE_AGENT_ROLE_ID).catch(() => {});
              }
              if (channel) {
                const expirationEmbed = new EmbedBuilder()
                  .setColor(0xffa500)
                  .setTitle('⏰ Contrato Expirado')
                  .setDescription(`O contrato de **${c.signee.username}** com **${c.teamName}** expirou após 24 horas.`)
                  .addFields(
                    { name: 'Jogador', value: `<@${c.signee.id}>`, inline: true },
                    { name: 'Time', value: c.teamName, inline: true },
                    { name: 'Posição', value: c.position, inline: true },
                  )
                  .setFooter({ text: 'The Classic Football League' })
                  .setTimestamp();
                await channel.send({
                  content: `⚠️ <@${c.contractor.id}> <@${c.signee.id}>`,
                  embeds: [expirationEmbed]
                });
              }
            }
          } catch (err) {
            console.error('Erro na expiração:', err);
          }
        }, remaining);
        expirationTimers.set(id, timer);
        console.log(`📂 Contrato carregado: ${c.signee.username} — ${c.teamName}`);
      } else {
        console.log(`⏰ Contrato expirado ignorado: ${c.signee.username}`);
      }
    }
    console.log(`✅ ${activeContracts.size} contrato(s) carregado(s) do disco.`);
  } catch (err) {
    console.error('Erro ao carregar contratos:', err);
  }
}

function generateContractId(signeeId, contractorId) {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000000000);
  return `T${timestamp}_${random}`;
}

function formatDate(date) {
  return date.toLocaleString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function hasCommandPermission(member) {
  return ALLOWED_COMMAND_ROLES.some(roleId => member.roles.cache.has(roleId));
}

function isContractChannelAllowed(channelId) {
  return ALLOWED_CONTRACT_CHANNELS.includes(channelId);
}

function isFaChannelAllowed(channelId) {
  return ALLOWED_FA_CHANNELS.includes(channelId);
}

function isScoutingChannelAllowed(channelId) {
  return ALLOWED_SCOUTING_CHANNELS.includes(channelId);
}

function isRoleAllowed(role) {
  if (ALLOWED_TEAM_ROLES.includes(role.id)) return true;
  if (ALLOWED_TEAM_ROLE_NAMES.includes(role.name)) return true;
  return false;
}

async function scheduleContractExpiration(contractId, contractData) {
  const timer = setTimeout(async () => {
    const contract = activeContracts.get(contractId);
    if (contract) {
      activeContracts.delete(contractId);
      expirationTimers.delete(contractId);
      saveContracts();
      try {
        const guild = client.guilds.cache.get(contract.guildId);
        if (guild) {
          const channel = guild.channels.cache.get(CONTRACT_ANNOUNCEMENT_CHANNEL);
          const member = await guild.members.fetch(contract.signee.id).catch(() => null);
          if (member && contract.teamRoleId) {
            await member.roles.remove(contract.teamRoleId).catch(err =>
              console.error('Erro ao remover cargo:', err)
            );
          }
          if (member) {
            await member.roles.add(FREE_AGENT_ROLE_ID).catch(() => {});
          }
          if (channel) {
            const expirationEmbed = new EmbedBuilder()
              .setColor(0xffa500)
              .setTitle('⏰ Contrato Expirado')
              .setDescription(`O contrato de **${contract.signee.username}** com **${contract.teamName}** expirou após 24 horas.`)
              .addFields(
                { name: 'Jogador', value: `<@${contract.signee.id}>`, inline: true },
                { name: 'Time', value: contract.teamName, inline: true },
                { name: 'Posição', value: contract.position, inline: true },
                { name: 'Assinado em', value: formatDate(contract.signedAt), inline: false },
                { name: 'Expirado em', value: formatDate(new Date()), inline: false }
              )
              .setFooter({ text: 'The Classic Football League' })
              .setTimestamp();
            await channel.send({
              content: `⚠️ <@${contract.contractor.id}> <@${contract.signee.id}>`,
              embeds: [expirationEmbed]
            });
          }
        }
      } catch (error) {
        console.error('Erro ao enviar notificação de expiração:', error);
      }
    }
  }, CONTRACT_EXPIRATION_TIME);
  expirationTimers.set(contractId, timer);
}

// ═══════════════════════════════════════════════════
// 🏗️ DEFINIÇÃO DOS SLASH COMMANDS
// ═══════════════════════════════════════════════════

const commands = [
  new SlashCommandBuilder()
    .setName('contract')
    .setDescription('Propor um contrato para um jogador')
    .addUserOption(opt => opt.setName('jogador').setDescription('O jogador que vai assinar').setRequired(true))
    .addStringOption(opt => opt.setName('posicao').setDescription('Posição do jogador (ex: cb, st, gk)').setRequired(true))
    .addStringOption(opt => opt.setName('role').setDescription('Role do jogador (ex: Titular, Subs)').setRequired(true)),

  new SlashCommandBuilder()
    .setName('fa')
    .setDescription('Anunciar que você está Free Agent')
    .addStringOption(opt => opt.setName('posicao').setDescription('Sua posição (ex: cb, st, gk)').setRequired(true))
    .addStringOption(opt => opt.setName('exp').setDescription('Sua experiência').setRequired(true))
    .addStringOption(opt => opt.setName('plataforma').setDescription('Sua plataforma (ex: PC, Mobile, Console)').setRequired(true))
    .addStringOption(opt => opt.setName('sobre').setDescription('Algo sobre você (opcional)').setRequired(false)),

  new SlashCommandBuilder()
    .setName('scouting')
    .setDescription('Anunciar um scout de jogador')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(opt => opt.setName('time').setDescription('Nome do time que deseja recrutar').setRequired(true))
    .addStringOption(opt => opt.setName('posicao').setDescription('Posição do jogador procurado').setRequired(true))
    .addStringOption(opt => opt.setName('sobre').setDescription('Descrição do scout (requisitos, etc)').setRequired(true)),

  new SlashCommandBuilder()
    .setName('release')
    .setDescription('Se liberar de um time e voltar a ser Free Agent'),

  new SlashCommandBuilder()
    .setName('release-jogador')
    .setDescription('Liberar um jogador do time do técnico')
    .addUserOption(opt =>
      opt.setName('jogador')
        .setDescription('Jogador que será liberado')
        .setRequired(true)
    ),

  // ─── NOVO /scrim COM MODAL ────────────────────────
  new SlashCommandBuilder()
    .setName('scrim')
    .setDescription('Anuncia um scrim (Apenas Scrim Hosters)')
    .addBooleanOption(opt =>
      opt.setName('ping_scrim')
        .setDescription('Deseja mencionar o cargo @Scrim Ping?')
        .setRequired(true)
    ),
  // ────────────────────────────────────────────────────

  new SlashCommandBuilder()
    .setName('janela')
    .setDescription('(Admin) Abre ou fecha a janela de transferências')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Faz um anúncio em formato embed em um canal específico (Apenas Administradores)')
    .setDefaultMemberPermissions(null)
    .addChannelOption(opt =>
      opt.setName('canal').setDescription('Canal onde o anúncio será enviado').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('mensagem').setDescription('Mensagem do anúncio').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('titulo').setDescription('Título do anúncio (opcional)').setRequired(false)
    ),
];

client.once('ready', async () => {
  console.log(`✅ Bot online como: ${client.user.tag}`);

  loadContracts();
  loadTransferWindow();
  reactionMessageId = loadReactionMessageId();

  const guild = client.guilds.cache.first();
  if (guild) {
    schedulePingInterval(guild);
  }

  client.user.setPresence({
    activities: [{ name: 'The Classic Football League', type: 0 }],
    status: 'online'
  });

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands.map(cmd => cmd.toJSON()) }
    );
    console.log('✅ Slash commands registrados!');
  } catch (err) {
    console.error('Erro ao registrar commands:', err);
  }
});

// ═══════════════════════════════════════════════════
// 🎫 DETECTAR CRIAÇÃO DE CANAL DE TICKET
// ═══════════════════════════════════════════════════

client.on('channelCreate', async (channel) => {
  if (!channel.name) return;
  const channelName = channel.name.toLowerCase();

  if (channelName.startsWith('ticket')) {
    console.log(`🎫 Novo ticket criado: #${channel.name}`);

    await new Promise(res => setTimeout(res, 1500));

    try {
      const members = channel.permissionOverwrites?.cache;
      let ticketOwner = null;

      if (members) {
        for (const [id, overwrite] of members) {
          if (overwrite.type === 1) {
            const member = await channel.guild.members.fetch(id).catch(() => null);
            if (member && !member.user.bot) {
              ticketOwner = member.user;
              break;
            }
          }
        }
      }

      await sendTicketWelcome(channel, ticketOwner ? `<@${ticketOwner.id}>` : 'usuário');
    } catch (err) {
      console.error('❌ Erro ao enviar boas-vindas no ticket:', err);
    }
  }
});

// ═══════════════════════════════════════════════════
// 🎯 EVENTO DE REAÇÕES (REACTION ROLES + SCRIM)
// ═══════════════════════════════════════════════════

client.on('messageReactionAdd', async (reaction, user) => {
  // Ignorar reações de bots
  if (user.bot) return;

  // Tratar reações parciais (mensagens não cacheadas)
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      console.error('Erro ao buscar reação parcial:', error);
      return;
    }
  }

  const messageId = reaction.message.id;

  // ─── SISTEMA DE SCRIM ────────────────────────────────
  // Verificar se a mensagem é um anúncio de scrim
  if (scrimData.has(messageId) && reaction.emoji.name === '✅') {
    const scrim = scrimData.get(messageId);

    // Evitar múltiplos envios do link
    if (scrimLinkSent.has(messageId)) return;

    try {
      // Buscar a mensagem atualizada para obter a contagem real de reações
      const fetchedMessage = await reaction.message.fetch();
      const reactionEmoji = fetchedMessage.reactions.cache.get('✅');

      if (reactionEmoji) {
        // Contar apenas usuários não-bots
        const users = await reactionEmoji.users.fetch();
        const userCount = users.filter(u => !u.bot).size;

        // Se a quantidade de reações atingiu os requisitos, envia o link
        if (userCount >= scrim.requisitos) {
          scrimLinkSent.add(messageId); // Marcar como enviado para evitar duplicação

          const linkEmbed = new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle('🔗 Link da Scrim')
            .setDescription(`A scrim atingiu **${scrim.requisitos}** reações! Aqui está o link de acesso:`)
            .addFields(
              { name: '🔗 Link', value: scrim.link, inline: false }
            )
            .setFooter({ text: 'The Classic Football League • Scrim' })
            .setTimestamp();

          await reaction.message.channel.send({
            content: `✅ A scrim atingiu **${scrim.requisitos}** reações!`,
            embeds: [linkEmbed]
          });

          console.log(`🔗 Link da scrim enviado para a mensagem ${messageId}`);
        }
      }
    } catch (err) {
      console.error('❌ Erro ao processar reação de scrim:', err);
    }
    return; // Não continua para o reaction roles
  }

  // ─── SISTEMA DE REACTION ROLES ───────────────────────
  if (reaction.message.id !== reactionMessageId) return;

  const emojiName = reaction.emoji.name;
  const roleConfig = REACTION_ROLES.find(r => r.emoji === emojiName);
  if (!roleConfig) return;

  try {
    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id);
    await member.roles.add(roleConfig.roleId);
    console.log(`✅ Cargo "${roleConfig.label}" adicionado a ${user.tag}`);

    await user.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle('✅ Cargo Recebido!')
          .setDescription(`Você recebeu o cargo **${roleConfig.label}** no servidor **The Classic Football League**!\n\nPara remover, é só tirar a reação.`)
          .setFooter({ text: 'The Classic Football League' })
          .setTimestamp()
      ]
    }).catch(() => {});
  } catch (err) {
    console.error('Erro ao adicionar cargo por reação:', err);
  }
});

client.on('messageReactionRemove', async (reaction, user) => {
  if (user.bot) return;
  if (reaction.message.id !== reactionMessageId) return;

  if (reaction.partial) {
    try { await reaction.fetch(); } catch { return; }
  }

  const emojiName = reaction.emoji.name;
  const roleConfig = REACTION_ROLES.find(r => r.emoji === emojiName);
  if (!roleConfig) return;

  try {
    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id);
    await member.roles.remove(roleConfig.roleId);
    console.log(`🗑️ Cargo "${roleConfig.label}" removido de ${user.tag}`);

    await user.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle('🗑️ Cargo Removido')
          .setDescription(`O cargo **${roleConfig.label}** foi removido do servidor **The Classic Football League**.\n\nPara receber novamente, reaja à mensagem de cargos.`)
          .setFooter({ text: 'The Classic Football League' })
          .setTimestamp()
      ]
    }).catch(() => {});
  } catch (err) {
    console.error('Erro ao remover cargo por reação:', err);
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const msgLower = message.content.toLowerCase().trim();
  const channelName = message.channel.name?.toLowerCase() || '';
  const isTicket = channelName.startsWith('ticket');

  if (
    message.member &&
    !message.member.permissions.has(PermissionFlagsBits.ManageMessages) &&
    !isTicket
  ) {
    if (INVITE_REGEX.test(message.content)) {
      try {
        await message.delete();
        const warning = await message.channel.send({
          content: `🚫 ${message.author}, **convites de outros servidores não são permitidos aqui!**`,
        });
        setTimeout(() => warning.delete().catch(() => {}), 5000);
        console.log(`🚫 Convite deletado de ${message.author.tag} em #${message.channel.name}`);
      } catch (err) {
        console.error('Erro ao deletar convite:', err);
      }
      return;
    }
  }

  if (DIVULGACAO_REGEX.test(msgLower)) {
    const temPermissao = message.member && ALLOWED_COMMAND_ROLES.some(id => message.member.roles.cache.has(id));
    if (!temPermissao) {
      try {
        await message.delete();
        const warning = await message.channel.send({
          content: `🚫 ${message.author}, **divulgações não são permitidas aqui!** Apenas membros autorizados podem fazer este tipo de anúncio.`,
        });
        setTimeout(() => warning.delete().catch(() => {}), 5000);
        console.log(`🚫 Divulgação bloqueada de ${message.author.tag} em #${message.channel.name}`);
      } catch (err) {
        console.error('Erro ao deletar divulgação:', err);
      }
      return;
    }
  }

  // ═══════════════════════════════════════════════════
  // 🎫 AUTO-RESPOSTA EM CANAIS DE TICKET
  // ═══════════════════════════════════════════════════

  if (isTicket) {
    for (const entry of TICKET_AUTO_RESPONSES) {
      const matched = entry.keywords.some(k => msgLower.includes(k));

      if (matched) {
        try {
          const embed = new EmbedBuilder()
            .setColor(entry.embed.color)
            .setTitle(entry.embed.title)
            .setDescription(entry.embed.description)
            .setFooter({ text: 'The Classic Football League' })
            .setTimestamp();

          const sent = await message.channel.send({
            content: `${message.author}`,
            embeds: [embed]
          });

          console.log(`🎫 Auto-resposta de ticket enviada em #${message.channel.name} para ${message.author.tag} (keyword: ${entry.embed.title})`);

          setTimeout(() => {
            sent.delete().catch(() => {});
          }, 60000);

        } catch (err) {
          console.error('❌ Erro no auto ticket:', err);
        }

        break;
      }
    }

    return;
  }

  // ═══════════════════════════════════════════════════
  // AUTO-RESPOSTAS GERAIS (fora de tickets)
  // ═══════════════════════════════════════════════════

  for (const entry of AUTO_RESPONSES) {
    const matched = entry.keywords.some(keyword => msgLower.includes(keyword));
    if (matched) {
      try {
        await message.reply({ content: entry.response });
      } catch (err) {
        console.error('Erro ao enviar resposta automática:', err);
      }
      return;
    }
  }
});

// ═══════════════════════════════════════════════════
// 🚀 HANDLER DE INTERAÇÕES (SLASH + BUTTONS + MODALS)
// ═══════════════════════════════════════════════════

client.on('interactionCreate', async (interaction) => {
  // ─── MODAL SUBMIT: SCrim ────────────────────────────
  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'scrim_modal') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        const formato = interaction.fields.getTextInputValue('scrim_formato');
        const requisitos = parseInt(interaction.fields.getTextInputValue('scrim_requisitos'));
        const host = interaction.fields.getTextInputValue('scrim_host');
        const link = interaction.fields.getTextInputValue('scrim_link');
        const pingScrim = interaction.fields.getTextInputValue('scrim_ping') === 'true'; // valor passado como string

        // Validar se requisitos é um número válido
        if (isNaN(requisitos) || requisitos <= 0) {
          return interaction.editReply({ content: '❌ A quantidade de requisitos deve ser um número válido maior que 0.' });
        }

        // Buscar o canal de scrim
        const scrimChannel = await interaction.guild.channels.fetch(SCRIM_CHANNEL).catch(() => null);
        if (!scrimChannel) {
          return interaction.editReply({ content: '❌ Canal de scrim não encontrado. Contate um administrador.' });
        }

        // Construir o conteúdo (com ou sem ping)
        const content = pingScrim ? `<@&${SCRIM_PING_ROLE}>` : '';

        // Construir embed moderna (apenas formato, host e requisitos)
        const scrimEmbed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('🎮 Nova Scrim')
          .addFields(
            { name: 'Formato', value: formato, inline: false },
            { name: 'Host', value: host, inline: true },
            { name: 'Quantidade necessária', value: `${requisitos} jogadores`, inline: true }
          )
          .setFooter({ text: 'The Classic Football League • Reaja com ✅ para participar' })
          .setTimestamp();

        // Enviar a mensagem
        const sentMessage = await scrimChannel.send({
          content: content,
          embeds: [scrimEmbed]
        });

        // Adicionar reação ✅ automaticamente
        await sentMessage.react('✅');

        // Armazenar dados da scrim no Map
        scrimData.set(sentMessage.id, {
          link: link,
          requisitos: requisitos,
          host: host,
          formato: formato,
          channelId: SCRIM_CHANNEL
        });

        console.log(`🎮 Scrim criada por ${interaction.user.tag} — Mensagem: ${sentMessage.id} | Requisitos: ${requisitos}`);

        await interaction.editReply({ content: '✅ Scrim anunciada com sucesso no canal de scrims!' });

      } catch (err) {
        console.error('❌ Erro ao processar modal de scrim:', err);
        await interaction.editReply({ content: '❌ Ocorreu um erro ao anunciar a scrim. Tente novamente.' });
      }
    }
    return;
  }

  // ─── SLASH COMMANDS ──────────────────────────────────
  if (interaction.isChatInputCommand()) {

    // ─── COMANDO /scrim ────────────────────────────
    if (interaction.commandName === 'scrim') {
      // Verificar se o usuário tem o cargo Scrim Hoster
      const hasPermission = SCRIM_HOSTER_ROLES.some(roleId =>
    interaction.member.roles.cache.has(roleId)
);

if (!hasPermission) {
    return interaction.reply({
        content: '❌ | Você precisa ter o cargo Scrim Hoster.',
        flags: MessageFlags.Ephemeral
    });
}

      // Obter a opção ping_scrim
      const pingScrim = interaction.options.getBoolean('ping_scrim') ?? false;

      // Criar o modal
      const modal = new ModalBuilder()
        .setCustomId('scrim_modal')
        .setTitle('🎮 Criar Scrim');

      // Campos do modal
      const formatoInput = new TextInputBuilder()
        .setCustomId('scrim_formato')
        .setLabel('Formato da Scrim')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 5v5, 3v3, etc.')
        .setRequired(true)
        .setMaxLength(100);

      const requisitosInput = new TextInputBuilder()
        .setCustomId('scrim_requisitos')
        .setLabel('Quantidade de jogadores necessária')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 4')
        .setRequired(true)
        .setMaxLength(3);

      const hostInput = new TextInputBuilder()
        .setCustomId('scrim_host')
        .setLabel('Host (Nick do Roblox)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Seu nick no Roblox')
        .setRequired(true)
        .setMaxLength(100);

      const linkInput = new TextInputBuilder()
        .setCustomId('scrim_link')
        .setLabel('Link da Scrim')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Link do servidor Roblox')
        .setRequired(true)
        .setMaxLength(200);

      // Campo oculto para passar o valor de ping_scrim
      const pingInput = new TextInputBuilder()
        .setCustomId('scrim_ping')
        .setLabel('Ping Scrim (não altere)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('true ou false')
        .setValue(pingScrim ? 'true' : 'false')
        .setRequired(true)
        .setMaxLength(5);

      // Adicionar campos ao modal (máximo 5 por linha)
      const row1 = new ActionRowBuilder().addComponents(formatoInput);
      const row2 = new ActionRowBuilder().addComponents(requisitosInput);
      const row3 = new ActionRowBuilder().addComponents(hostInput);
      const row4 = new ActionRowBuilder().addComponents(linkInput);
      const row5 = new ActionRowBuilder().addComponents(pingInput);

      modal.addComponents(row1, row2, row3, row4, row5);

      // Mostrar o modal
      await interaction.showModal(modal);
      return;
    }

    // ─── OUTROS COMANDOS ────────────────────────────

    // ═══════════════════════════════════════════════════
    // 🪟 COMANDO /janela
    // ═══════════════════════════════════════════════════

   if (interaction.commandName === 'janela') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle('🔒 Acesso Negado')
              .setDescription('Apenas **administradores** podem usar este comando.')
              .setFooter({ text: 'The Classic Football League' })
              .setTimestamp()
          ],
          flags: MessageFlags.Ephemeral
        });
      }

      return interaction.reply({
        embeds: [buildTransferWindowEmbed()],
        components: [buildTransferWindowSelectMenu()],
        flags: MessageFlags.Ephemeral
      });
    }

    if (interaction.commandName === 'contract') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (!isContractChannelAllowed(interaction.channelId)) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('❌ Canal Não Permitido').setDescription('Este comando só pode ser utilizado em canais específicos.').setFooter({ text: 'The Classic Football League' }).setTimestamp()]
        });
      }

      if (!hasCommandPermission(interaction.member)) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('🔒 Sem Permissão').setDescription('Você não tem permissão para usar este comando.\n\nApenas membros autorizados podem criar contratos.').setFooter({ text: 'The Classic Football League' }).setTimestamp()]
        });
      }

      const signee = interaction.options.getUser('jogador');
      const position = interaction.options.getString('posicao');
      const role = interaction.options.getString('role');
      const contractor = interaction.user;

      const teamRoleIds = ALLOWED_TEAM_ROLES.filter(roleId =>
        interaction.member.roles.cache.has(roleId)
      );

      if (teamRoleIds.length === 0) {
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('❌ Time Não Identificado')
            .setDescription('Você precisa ter um cargo de time autorizado para criar um contrato.')
            .setFooter({ text: 'The Classic Football League' })
            .setTimestamp()]
        });
      }

      if (teamRoleIds.length > 1) {
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('❌ Mais de um Time Identificado')
            .setDescription('Você possui mais de um cargo de time autorizado. Remova os cargos extras antes de criar o contrato.')
            .setFooter({ text: 'The Classic Football League' })
            .setTimestamp()]
        });
      }

      const teamRole = interaction.guild.roles.cache.get(teamRoleIds[0]);
      if (!teamRole) {
        return interaction.editReply({
          content: '❌ Não foi possível identificar o cargo do seu time.'
        });
      }

      const existingContract = [...activeContracts.values()].find(c => c.signee.id === signee.id);
      if (existingContract) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('❌ Contrato Já Existente').setDescription(`${signee} já possui um contrato ativo com **${existingContract.teamName}**.`).setFooter({ text: 'The Classic Football League' }).setTimestamp()]
        });
      }

      if (!isRoleAllowed(teamRole)) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle('❌ Cargo Não Permitido')
              .setDescription(`O cargo **${teamRole.name}** não está autorizado para contratos.\n\nApenas cargos de times podem ser usados.`)
              .setFooter({ text: 'The Classic Football League' })
              .setTimestamp()
          ]
        });
      }

      if (!transferWindow.clubs) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('🚫 Janela de Clubs Fechada').setDescription('A janela de transferências para **clubes** está fechada no momento.').setFooter({ text: 'The Classic Football League • Janela de transferências fechada para clubes' }).setTimestamp()]
        });
      }

      const guildMembers = await interaction.guild.members.fetch();
      const rosterCount = guildMembers.filter(member => member.roles.cache.has(teamRole.id)).size;
      if (rosterCount >= ROSTER_CAP) {
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('🚫 Roster Cheio')
            .setDescription(`O time **${teamRole.name}** já possui **${rosterCount}/${ROSTER_CAP}** jogadores. Este contrato não pode ser criado.`)
            .setFooter({ text: 'The Classic Football League • Limite de roster atingido' })
            .setTimestamp()]
        });
      }

      if (
        teamRole.permissions.has(PermissionFlagsBits.Administrator) ||
        teamRole.permissions.has(PermissionFlagsBits.ManageGuild) ||
        teamRole.permissions.has(PermissionFlagsBits.ManageRoles)
      ) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('🔒 Cargo Administrativo Bloqueado').setDescription(`Por segurança, cargos com permissões administrativas não podem ser usados em contratos.`).setFooter({ text: 'The Classic Football League' }).setTimestamp()]
        });
      }

      const contractId = generateContractId(signee.id, contractor.id);

      const contractData = {
        contractId,
        signee,
        contractor,
        teamName: teamRole.name,
        teamRoleId: teamRole.id,
        position,
        role,
        proposedAt: new Date(),
        channelId: interaction.channelId,
        guildId: interaction.guildId,
      };

      pendingContracts.set(contractId, contractData);

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle('📋 Agreement Contract')
        .setDescription(`By signing this contract, you commit to representing the Contractor and their team with dedication throughout the tournament, competing to the best of your abilities and upholding team loyalty.`)
        .addFields(
          { name: 'Signee', value: `${signee}\n${signee.username}`, inline: true },
          { name: 'Contractor', value: `${contractor}\n${contractor.username}`, inline: true },
          { name: 'Team', value: teamRole.name, inline: true },
          { name: 'Position', value: position, inline: true },
          { name: 'Role', value: role, inline: true },
        )
        .setFooter({ text: `The Classic Football League • ${new Date().toLocaleDateString('pt-BR')}` })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`accept_${contractId}`).setLabel('Accept').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`reject_${contractId}`).setLabel('Reject').setStyle(ButtonStyle.Danger)
      );

      try {
        await sendToChannel(
          interaction.guild,
          CONTRACT_ANNOUNCEMENT_CHANNEL,
          {
            content: `🔔 ${signee}, um contrato foi proposto por ${contractor}.`,
            embeds: [embed],
            components: [row],
          },
          `Contract — ${signee.username}`
        );
      } catch (err) {
        console.error('❌ Erro ao enviar contract no canal de anúncios:', err);
      }

      await interaction.editReply({ content: '✅ Contrato enviado para o canal de contratos!' });

      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('📋 Contract Recebido!')
          .setDescription(`Você recebeu um **offer de contract** na liga **The Classic Football League**!`)
          .addFields(
            { name: '👕 Time', value: teamRole.name, inline: true },
            { name: '⚽ Posição', value: position, inline: true },
            { name: '👤 Enviado por', value: contractor.username, inline: false },
            { name: 'Ação Necessária', value: `Confira os detalhes e aceite ou rejeite o contrato no canal:\n\n🔗 [Ir para o Canal de Contratos](https://discord.com/channels/${CONTRACT_GUILD_ID}/${CONTRACT_ANNOUNCEMENT_CHANNEL})`, inline: false }
          )
          .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
          .setFooter({ text: 'The Classic Football League • Responda o mais rápido possível!' })
          .setTimestamp();

        await signee.send({ embeds: [dmEmbed] });
        console.log(`✅ DM de contrato enviada para ${signee.username}`);
      } catch (err) {
        console.log(`⚠️ Não foi possível enviar DM para ${signee.username}: ${err.message}`);
      }
    }

    else if (interaction.commandName === 'announce') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const hasAnnouncePermission = ALLOWED_ANNOUNCE_ROLES.some(id => interaction.member.roles.cache.has(id));

      if (!hasAnnouncePermission) {
        return interaction.editReply({ content: '❌ Você não tem permissão para usar este comando.' });
      }

      const canal = interaction.options.getChannel('canal');
      const mensagem = interaction.options.getString('mensagem').replace(/\\n/g, '\n');
      const titulo = interaction.options.getString('titulo');

      const announceEmbed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setDescription(titulo ? `# ${titulo}\n\n${mensagem}` : mensagem)
        .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
        .setFooter({ text: 'The Classic Football League' })
        .setTimestamp();

      try {
        await canal.send({ embeds: [announceEmbed] });
        await interaction.editReply({ content: `✅ Anúncio enviado com sucesso em ${canal}!` });
        console.log(`📢 Anúncio enviado por ${interaction.user.tag} no canal #${canal.name}`);
      } catch (err) {
        console.error('❌ Erro ao enviar anúncio:', err);
        await interaction.editReply({ content: '❌ Não foi possível enviar o anúncio. Verifique se o bot tem permissão nesse canal.' });
      }
    }

    else if (interaction.commandName === 'fa') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (!transferWindow.freeAgent) {
  return interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('🚫 Janela de Free Agent Fechada')
        .setDescription('Os anúncios de **Free Agent** estão desativados no momento.\nAguarde a abertura da janela para se anunciar.')
        .setFooter({ text: 'The Classic Football League • Janela de FA fechada' })
        .setTimestamp()
    ]
  });
}
      
      if (!isFaChannelAllowed(interaction.channelId)) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('❌ Canal Não Permitido').setDescription('Este comando só pode ser utilizado em canais específicos.').setFooter({ text: 'The Classic Football League' }).setTimestamp()]
        });
      }

      const hasTeamRole = ALLOWED_TEAM_ROLES.some(id => interaction.member.roles.cache.has(id));
      if (hasTeamRole) {
        return interaction.editReply({
          content: `❌ Você já é de um time! Se quiser sair, use **/release** no canal <#${ALLOWED_RELEASE_CHANNELS[0]}>.`,
        });
      }

      const posicao = interaction.options.getString('posicao');
      const exp = interaction.options.getString('exp');
      const plataforma = interaction.options.getString('plataforma');
      const sobre = interaction.options.getString('sobre');

      const faEmbed = new EmbedBuilder()
        .setColor(0xf0c030)
        .setTitle('📢 Free Agent')
        .setDescription(`${interaction.user} está disponível para ser contratado!`)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: 'Posição', value: posicao, inline: true },
          { name: 'Plataforma', value: plataforma, inline: true },
          { name: 'Experiência', value: exp, inline: false },
        );

      if (sobre) {
        faEmbed.addFields({ name: '💬 Sobre', value: sobre, inline: false });
      }

      faEmbed
        .setFooter({ text: `The Classic Football League • ${new Date().toLocaleDateString('pt-BR')}` })
        .setTimestamp();

      await interaction.editReply({ content: '✅ Seu anúncio de Free Agent foi publicado!' });

      try {
        await sendToChannel(interaction.guild, FA_ANNOUNCEMENT_CHANNEL, { embeds: [faEmbed] }, `FA — ${interaction.user.username}`);
      } catch (err) {
        console.error('❌ Erro ao enviar FA no canal de anúncios:', err);
      }
    }

    else if (interaction.commandName === 'scouting') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      if (!isScoutingChannelAllowed(interaction.channelId)) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('❌ Canal Não Permitido').setDescription('Este comando só pode ser utilizado em canais específicos.').setFooter({ text: 'The Classic Football League' }).setTimestamp()]
        });
      }

      if (!hasCommandPermission(interaction.member)) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('🔒 Sem Permissão').setDescription('Você não tem permissão para usar este comando.\n\nApenas membros autorizados podem fazer scouting.').setFooter({ text: 'The Classic Football League' }).setTimestamp()]
        });
      }

      const time = interaction.options.getString('time');
      const posicao = interaction.options.getString('posicao');
      const sobre = interaction.options.getString('sobre');
      const scout = interaction.user;

      const scoutingEmbed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('🔍 Anúncio de Scouting')
        .setDescription(`${scout} está procurando novos talentos!`)
        .setThumbnail(scout.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: 'Time', value: time, inline: true },
          { name: 'Posição', value: posicao, inline: true },
          { name: '📝 Detalhes', value: sobre, inline: false },
          { name: 'Scout', value: `${scout}`, inline: true },
        )
        .setFooter({ text: `The Classic Football League • ${new Date().toLocaleDateString('pt-BR')}` })
        .setTimestamp();

      await interaction.editReply({ content: '✅ Seu anúncio de scouting foi publicado!' });

      try {
        await sendToChannel(interaction.guild, SCOUTING_ANNOUNCEMENT_CHANNEL, { embeds: [scoutingEmbed] }, `Scouting — ${scout.username}`);
      } catch (err) {
        console.error('❌ Erro ao enviar scouting no canal de anúncios:', err);
      }
    }

    else if (interaction.commandName === 'release-jogador') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (!ALLOWED_RELEASE_CHANNELS.includes(interaction.channelId)) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('❌ Canal Não Permitido').setDescription('Este comando só pode ser utilizado em canais específicos.').setFooter({ text: 'The Classic Football League' }).setTimestamp()]
        });
      }

      if (!hasCommandPermission(interaction.member)) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('🔒 Sem Permissão').setDescription('Apenas membros com um cargo em **Allowed Command Roles** podem usar este comando.').setFooter({ text: 'The Classic Football League' }).setTimestamp()]
        });
      }

      const technicianTeamRoles = ALLOWED_TEAM_ROLES.filter(roleId => interaction.member.roles.cache.has(roleId));
      if (technicianTeamRoles.length !== 1) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('❌ Time do Técnico Indefinido').setDescription('Você precisa ter exatamente um cargo de time autorizado para liberar jogadores.').setFooter({ text: 'The Classic Football League' }).setTimestamp()]
        });
      }

      const targetUser = interaction.options.getUser('jogador');
      const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!targetMember) {
        return interaction.editReply({ content: '❌ Não foi possível encontrar esse jogador no servidor.' });
      }

      const technicianTeamRoleId = technicianTeamRoles[0];
      if (!targetMember.roles.cache.has(technicianTeamRoleId)) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('❌ Jogador de Outro Time').setDescription('Você só pode liberar jogadores que tenham o mesmo cargo de time que você.').setFooter({ text: 'The Classic Football League' }).setTimestamp()]
        });
      }

      const targetTeamRoles = ALLOWED_TEAM_ROLES.filter(roleId => targetMember.roles.cache.has(roleId));
      const technicianTeamRole = interaction.guild.roles.cache.get(technicianTeamRoleId);
      const removedTeamRoles = targetTeamRoles
        .map(roleId => interaction.guild.roles.cache.get(roleId))
        .filter(Boolean);

      try {
        await targetMember.roles.remove(targetTeamRoles);

        for (const [id, contract] of activeContracts) {
          if (contract.signee.id === targetUser.id) {
            activeContracts.delete(id);
            const timer = expirationTimers.get(id);
            if (timer) {
              clearTimeout(timer);
              expirationTimers.delete(id);
            }
          }
        }
        saveContracts();
        await targetMember.roles.add(FREE_AGENT_ROLE_ID);

        const releaseEmbed = new EmbedBuilder()
          .setColor(0xf0c030)
          .setTitle('🔓 Jogador Liberado')
          .setDescription(`${targetUser} foi liberado por ${interaction.user} e não faz mais parte de nenhum time.`)
          .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
          .addFields(
            { name: 'Jogador', value: `${targetUser}`, inline: true },
            { name: 'Técnico', value: `${interaction.user}`, inline: true },
            { name: 'Time Validado', value: technicianTeamRole?.name || 'Time', inline: true },
            { name: 'Cargos Removidos', value: removedTeamRoles.map(role => role.name).join(', '), inline: false },
            { name: 'Status', value: '🟡 Free Agent', inline: true },
          )
          .setFooter({ text: `The Classic Football League • ${new Date().toLocaleDateString('pt-BR')}` })
          .setTimestamp();

        await sendToChannel(
          interaction.guild,
          RELEASE_ANNOUNCEMENT_CHANNEL,
          {
            content: `${targetUser} foi liberado por ${interaction.user}.`,
            embeds: [releaseEmbed],
          },
          `Release — ${targetUser.username}`
        );

        await interaction.editReply({ embeds: [releaseEmbed] });
      } catch (err) {
        console.error('❌ Erro ao liberar jogador pelo técnico:', err);
        await interaction.editReply({ content: '❌ Não foi possível liberar o jogador. Verifique se o bot pode gerenciar os cargos.' });
      }
    }

    else if (interaction.commandName === 'release') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      if (!ALLOWED_RELEASE_CHANNELS.includes(interaction.channelId)) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('❌ Canal Não Permitido').setDescription('Este comando só pode ser utilizado em canais específicos.').setFooter({ text: 'The Classic Football League' }).setTimestamp()]
        });
      }

      const member = interaction.member;
      const teamRoles = [];

      ALLOWED_TEAM_ROLES.forEach(roleId => {
        if (member.roles.cache.has(roleId)) {
          const role = interaction.guild.roles.cache.get(roleId);
          if (role) teamRoles.push({ id: roleId, name: role.name, type: 'team' });
        }
      });

      const allOwnedRoles = teamRoles;

      if (allOwnedRoles.length === 0) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('❌ Sem Time').setDescription('Você não possui nenhum cargo de time para se liberar.').setFooter({ text: 'The Classic Football League' }).setTimestamp()]
        });
      }

      const releaseFromRole = async (roleId, roleName) => {
        try {
          await member.roles.remove(roleId);
          
          for (const [id, c] of activeContracts) {
            if (c.signee.id === interaction.user.id) {
              activeContracts.delete(id);
              const timer = expirationTimers.get(id);
              if (timer) {
                clearTimeout(timer);
                expirationTimers.delete(id);
              }
              saveContracts();
              break;
            }
          }

          const stillHasTeam = ALLOWED_TEAM_ROLES.some(rid => member.roles.cache.has(rid));
          if (!stillHasTeam) {
            await member.roles.add(FREE_AGENT_ROLE_ID);
          }

          const releaseEmbed = new EmbedBuilder()
            .setColor(0xf0c030)
            .setTitle('🔓 Liberação Confirmada')
            .setDescription(`${interaction.user} não faz mais parte de **${roleName}**.`)
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
            .addFields(
              { name: 'Jogador', value: `${interaction.user}`, inline: true },
              { name: 'Cargo Removido', value: roleName, inline: true },
              { name: 'Status', value: stillHasTeam ? 'Ainda em outro time' : '🟡 Free Agent', inline: true },
            )
            .setFooter({ text: `The Classic Football League • ${new Date().toLocaleDateString('pt-BR')}` })
            .setTimestamp();

          await sendToChannel(
            interaction.guild,
            RELEASE_ANNOUNCEMENT_CHANNEL,
            {
              content: `${interaction.user} não faz mais parte de **${roleName}**.`,
              embeds: [releaseEmbed],
            },
            `Release — ${interaction.user.username}`
          );

          return releaseEmbed;
        } catch (err) {
          console.error('❌ Erro ao liberar jogador:', err);
          throw err;
        }
      };

      if (allOwnedRoles.length === 1) {
        const singleRole = allOwnedRoles[0];
        try {
          const embed = await releaseFromRole(singleRole.id, singleRole.name);
          await interaction.editReply({ embeds: [embed] });
        } catch {
          await interaction.editReply({ content: '❌ Ocorreu um erro ao processar sua liberação. Verifique se o bot tem permissão para gerenciar cargos.' });
        }
        return;
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('release_select')
        .setPlaceholder('Escolha de qual time você deseja sair...')
        .addOptions(
          allOwnedRoles.map(role => ({
            label: role.name,
            value: role.id,
            description: 'Cargo de time',
          }))
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      const chooseEmbed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('🤔 De qual você quer sair?')
        .setDescription('Você possui mais de um cargo de time. Escolha abaixo de qual deseja se liberar.')
        .setFooter({ text: 'The Classic Football League' })
        .setTimestamp();

      await interaction.editReply({
        embeds: [chooseEmbed],
        components: [row],
      });
    }
  }

  // ─── BOTÕES ───────────────────────────────────────────
  if (interaction.isButton()) {
    const [action, contractId] = interaction.customId.split('_').reduce((acc, part, i) => {
      if (i === 0) acc[0] = part;
      else acc[1] = (acc[1] ? acc[1] + '_' + part : part);
      return acc;
    }, []);

    const contractData = pendingContracts.get(contractId);
    if (!contractData) {
      return interaction.reply({ content: '❌ Contrato não encontrado ou já processado.', flags: MessageFlags.Ephemeral });
    }

    if (interaction.user.id !== contractData.signee.id) {
      return interaction.reply({ content: '❌ Apenas o jogador indicado pode aceitar ou rejeitar este contrato.', flags: MessageFlags.Ephemeral });
    }

    if (action === 'accept') {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + CONTRACT_EXPIRATION_TIME);

      const signedContract = { ...contractData, signedAt: now, expiresAt: expiresAt };

      activeContracts.set(contractId, signedContract);
      pendingContracts.delete(contractId);
      saveContracts();

      scheduleContractExpiration(contractId, signedContract);

      try {
        const guild = interaction.guild;
        const member = await guild.members.fetch(contractData.signee.id);
        if (member && contractData.teamRoleId) {
          await member.roles.add(contractData.teamRoleId);
          console.log(`✅ Cargo ${contractData.teamName} adicionado a ${member.user.tag}`);
        }
        if (member && member.roles.cache.has(FREE_AGENT_ROLE_ID)) {
          await member.roles.remove(FREE_AGENT_ROLE_ID);
          console.log(`🗑️ Cargo FA removido de ${member.user.tag}`);
        }
      } catch (err) {
        console.error('❌ Erro ao adicionar/remover cargo:', err);
      }

      const successEmbed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('✅ Contract Accepted')
        .setDescription(`${contractData.signee} has successfully signed with **${contractData.teamName}**`)
        .addFields(
          { name: 'Signee', value: `${contractData.signee}\n${contractData.signee.username}`, inline: true },
          { name: 'Contractor', value: `${contractData.contractor}\n${contractData.contractor.username}`, inline: true },
          { name: 'Team', value: contractData.teamName, inline: true },
          { name: 'Position', value: contractData.position, inline: true },
          { name: 'Role', value: contractData.role, inline: true },
          { name: 'Signed on', value: `<t:${Math.floor(now.getTime() / 1000)}:F>`, inline: false },
        )
        .setFooter({ text: `The Classic Football League • ${new Date().toLocaleDateString('pt-BR')}` })
        .setTimestamp();

      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('disabled_accept').setLabel('Accept').setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId('disabled_reject').setLabel('Reject').setStyle(ButtonStyle.Danger).setDisabled(true)
      );

      await interaction.update({ content: `✅ ${contractData.signee} accepted the contract!`, embeds: [successEmbed], components: [disabledRow] });

    } else if (action === 'reject') {
      pendingContracts.delete(contractId);

      const rejectEmbed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('❌ Contract Rejected')
        .setDescription(`${contractData.signee} rejected the contract proposed by ${contractData.contractor} for team **${contractData.teamName}**.`)
        .setFooter({ text: 'The Classic Football League' })
        .setTimestamp();

      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('disabled_accept').setLabel('Accept').setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId('disabled_reject').setLabel('Reject').setStyle(ButtonStyle.Danger).setDisabled(true)
      );

      await interaction.update({ content: `❌ ${contractData.signee} rejected the contract.`, embeds: [rejectEmbed], components: [disabledRow] });
    }
  }

  // ─── SELECT MENUS ─────────────────────────────────────
  if (interaction.isStringSelectMenu()) {

    // 🪟 SELECT MENU DA JANELA DE TRANSFERÊNCIAS
    if (interaction.customId === 'transfer_window_select') {
      const selected = interaction.values[0];
      transferWindow[selected] = !transferWindow[selected];
      saveTransferWindow();

      const nomeLegivel = selected === 'clubs' ? '🏟️ Clubs' : '🟡 Free Agent';
      const novoEstado = transferWindow[selected] ? '🟢 **Aberta**' : '🔴 **Fechada**';

      console.log(`🪟 Janela "${selected}" alterada para: ${transferWindow[selected] ? 'ABERTA' : 'FECHADA'} por ${interaction.user.tag}`);

      await interaction.update({
        embeds: [buildTransferWindowEmbed()],
        components: [buildTransferWindowSelectMenu()]
      });

      await interaction.followUp({
        embeds: [
          new EmbedBuilder()
            .setColor(transferWindow[selected] ? 0x57f287 : 0xed4245)
            .setTitle('🪟 Janela Atualizada')
            .setDescription(`A janela **${nomeLegivel}** foi alterada para ${novoEstado}.`)
            .setFooter({ text: `The Classic Football League • Alterado por ${interaction.user.username}` })
            .setTimestamp()
        ],
        flags: MessageFlags.Ephemeral
      });

      if (selected === 'clubs') {
        try {
          await sendToChannel(
            interaction.guild,
            CONTRACT_ANNOUNCEMENT_CHANNEL,
            { content: transferWindow.clubs ? '🔓 Janela de contratos aberta.' : '🔒 Janela de contratos fechada.' },
            `Janela de contratos — ${transferWindow.clubs ? 'Aberta' : 'Fechada'}`
          );
        } catch (err) {
          console.error('❌ Erro ao anunciar alteração da janela de contratos:', err);
        }
      }

      return;
    }

    // 🔓 SELECT MENU DE RELEASE
    if (interaction.customId === 'release_select') {
      const selectedRoleId = interaction.values[0];
      const selectedRole = interaction.guild.roles.cache.get(selectedRoleId);
      if (!selectedRole) {
        return interaction.update({ content: '❌ Cargo não encontrado.', embeds: [], components: [] });
      }

      const member = interaction.member;
      await interaction.deferUpdate();

      try {
        await member.roles.remove(selectedRoleId);
        
        for (const [id, c] of activeContracts) {
          if (c.signee.id === interaction.user.id) {
            activeContracts.delete(id);
            const timer = expirationTimers.get(id);
            if (timer) {
              clearTimeout(timer);
              expirationTimers.delete(id);
            }
            saveContracts();
            break;
          }
        }

        const stillHasTeam = ALLOWED_TEAM_ROLES.some(rid => member.roles.cache.has(rid));
        if (!stillHasTeam) {
          await member.roles.add(FREE_AGENT_ROLE_ID);
        }

        const releaseEmbed = new EmbedBuilder()
          .setColor(0xf0c030)
          .setTitle('🔓 Liberação Confirmada')
          .setDescription(`${interaction.user} não faz mais parte de **${selectedRole.name}**.`)
          .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
          .addFields(
            { name: 'Jogador', value: `${interaction.user}`, inline: true },
            { name: 'Cargo Removido', value: selectedRole.name, inline: true },
            { name: 'Status', value: stillHasTeam ? 'Ainda em outro time' : '🟡 Free Agent', inline: true },
          )
          .setFooter({ text: `The Classic Football League • ${new Date().toLocaleDateString('pt-BR')}` })
          .setTimestamp();

        await sendToChannel(
          interaction.guild,
          RELEASE_ANNOUNCEMENT_CHANNEL,
          {
            content: `${interaction.user} não faz mais parte de **${selectedRole.name}**.`,
            embeds: [releaseEmbed],
          },
          `Release — ${interaction.user.username}`
        );

        await interaction.editReply({
          content: `✅ Você saiu de **${selectedRole.name}** com sucesso!`,
          embeds: [],
          components: []
        });

      } catch (err) {
        console.error('❌ Erro ao liberar jogador:', err);
        await interaction.editReply({
          content: '❌ Ocorreu um erro ao processar sua liberação.',
          embeds: [],
          components: []
        });
      }
    }
  }
});

client.login(process.env.DISCORD_TOKEN);