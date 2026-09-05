const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { ALLOWED_SANCTION_ROLES, SANCTION_CHANNEL_ID, STJD_LINK } = require('../config/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Registra o desbanimento de um usuário.')
    .addUserOption(opt => opt.setName('jogador').setDescription('Usuário a ser desbanido').setRequired(true))
    .addStringOption(opt => opt.setName('motivo').setDescription('Motivo do desbanimento').setRequired(true)),
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

    // Embed para o canal de SANCTION
    const unbanEmbed = new EmbedBuilder()
      .setColor(0x2b2d31) // Cinza escuro/preto
      .setTitle('BR4 UNBAN')
      .setDescription(
        `⬜ **Nome do usuário desbanido:** ${jogador.username}\n` +
        `⬜ **Motivo do desbanimento:** ${motivo}\n` +
        `⬜ **Discord ID:** ${jogador.id}\n\n` +
        `O usuário teve seu banimento revogado e está liberado para retornar à liga.\n\n` +
        `**BR4 STJD**\n${STJD_LINK}`
      )
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }));

    // Enviar no canal de Sanction
    try {
      const channel = await interaction.guild.channels.fetch(SANCTION_CHANNEL_ID);
      if (channel) {
        await channel.send({
          content: `Desbanimento registrado por: ${interaction.user}`,
          embeds: [unbanEmbed]
        });
      }
    } catch (err) {
      console.error('Erro ao enviar log de unban:', err);
      return interaction.editReply({ content: '❌ Erro ao enviar log no canal de Sanctions. Verifique as permissões e o ID do canal.' });
    }

    // Tentar desbanir o usuário do servidor
    try {
      await interaction.guild.members.unban(jogador.id, `BR4 UNBAN: ${motivo}`);
    } catch (err) {
      console.log(`Não foi possível desbanir ${jogador.tag} do servidor (pode não estar banido).`);
    }

    await interaction.editReply({
      content: `✅ Unban aplicado ao jogador ${jogador}. Ele foi desbanido do servidor.`
    });
  }
};
