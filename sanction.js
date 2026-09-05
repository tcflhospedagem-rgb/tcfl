const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { ALLOWED_SANCTION_ROLES, SANCTION_CHANNEL_ID, STJD_LINK } = require('../config/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sanction')
    .setDescription('Registra o banimento de um usuário e envia o aviso na DM.')
    .addUserOption(opt => opt.setName('jogador').setDescription('Usuário banido').setRequired(true))
    .addStringOption(opt => opt.setName('motivo').setDescription('Motivo do banimento').setRequired(true))
    .addStringOption(opt => opt.setName('robux').setDescription('Valor da Bail em Robux (ex: 2300)').setRequired(true))
    .addStringOption(opt => opt.setName('volta').setDescription('Condição de volta (ex: N/A)').setRequired(true)),
  async execute(interaction, client) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const hasCommandPermission = ALLOWED_SANCTION_ROLES.some(roleId => interaction.member.roles.cache.has(roleId));
    if (!hasCommandPermission && !interaction.member.permissions.has('Administrator')) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('🔒 Sem Permissão').setDescription('Você não tem permissão para usar este comando.').setFooter({ text: 'BR4 (Brazilian Roblox 2024)' })]
      });
    }

    const jogador = interaction.options.getUser('jogador');
    const motivo = interaction.options.getString('motivo');
    const robux = interaction.options.getString('robux');
    const volta = interaction.options.getString('volta');

    // Embed para o canal de SANCTION
    const sanctionEmbed = new EmbedBuilder()
      .setColor(0x57F287) // Verde
      .setTitle('BR4 SANCTION')
      .setDescription(
        `🟩 **Nome do usuário banido:** ${jogador.username} (${jogador.id})\n` +
        `🟩 **Motivo do banimento:** ${motivo}\n` +
        `🟩 **Bail em Robux:** ${robux} <:Robux:1514712779347460188>\n` +
        `🟩 **Volta:** ${volta}\n\n` +
        `Todos os banimentos concedem ao usuário o direito de appeal em nosso STJD,\n` +
        `onde, ao provar que não cometeu nenhuma infração na liga,\n` +
        `poderá solicitar a revisão da punição.\n\n` +
        `**BR4 STJD**\n${STJD_LINK}`
      )
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }));

    // Embed para a DM do usuário
    const dmEmbed = new EmbedBuilder()
      .setColor(0xed4245) // Vermelho
      .setTitle('BR4 SANCTION')
      .setDescription(
        `Você foi banido da BR4 / You were banned from BR4\n\n` +
        `**Motivo/Reason:** ${motivo}\n` +
        `**Bail/Blacklist:** ${robux} + ${volta}\n` +
        `**Volta/Return:** ${volta}\n\n` +
        `**BR4 STJD:**\n${STJD_LINK}`
      );

    // Tentar enviar DM
    let dmEnviada = true;
    try {
      await jogador.send({ embeds: [dmEmbed] });
    } catch (err) {
      dmEnviada = false;
      console.log(`Não foi possível enviar DM para ${jogador.tag}`);
    }

    // Enviar no canal de Sanction
    try {
      const channel = await interaction.guild.channels.fetch(SANCTION_CHANNEL_ID);
      if (channel) {
        await channel.send({
          content: `Banimento registrado por: ${interaction.user}`,
          embeds: [sanctionEmbed]
        });
      }
    } catch (err) {
      console.error('Erro ao enviar log de sanction:', err);
      return interaction.editReply({ content: '❌ Erro ao enviar log no canal de Sanctions. Verifique as permissões e o ID do canal.' });
    }

    // Tentar banir o usuário do servidor
    try {
      await interaction.guild.members.ban(jogador.id, { reason: `BR4 SANCTION: ${motivo}` });
    } catch (err) {
      console.log(`Não foi possível banir ${jogador.tag} do servidor (talvez já não esteja no servidor ou falta de permissão).`);
    }

    await interaction.editReply({
      content: `✅ Sanction aplicada ao jogador ${jogador}. DM Enviada: ${dmEnviada ? 'Sim' : 'Não'}`
    });
  }
};
