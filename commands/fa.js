const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { ALLOWED_FA_CHANNELS, ALLOWED_TEAM_ROLES, FA_ANNOUNCEMENT_CHANNEL, ALLOWED_RELEASE_CHANNELS } = require('../config/constants');
const { getTransferWindow } = require('../systems/transferWindow');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fa')
    .setDescription('Anunciar que você está Free Agent')
    .addStringOption(opt => opt.setName('mensagem').setDescription('Mensagem do seu anúncio Free Agent').setRequired(true)),
  async execute(interaction, client) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const transferWindow = getTransferWindow();
    if (!transferWindow.freeAgent) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('🚫 Janela de Free Agent Fechada')
            .setDescription('Os anúncios de **Free Agent** estão desativados no momento.\nAguarde a abertura da janela para se anunciar.')
            .setFooter({ text: 'BR4 (Brazilian Roblox 2024) • Janela de FA fechada' })
            .setTimestamp()
        ]
      });
    }

    if (!ALLOWED_FA_CHANNELS.includes(interaction.channelId)) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('❌ Canal Não Permitido').setDescription('Este comando só pode ser utilizado em canais específicos.').setFooter({ text: 'BR4 (Brazilian Roblox 2024)' }).setTimestamp()]
      });
    }

    const hasTeamRole = ALLOWED_TEAM_ROLES.some(id => interaction.member.roles.cache.has(id));
    if (hasTeamRole) {
      return interaction.editReply({
        content: `❌ Você já é de um time! Se quiser sair, use **/release** no canal <#${ALLOWED_RELEASE_CHANNELS[0]}>.`,
      });
    }

    const mensagem = interaction.options.getString('mensagem');
    const userName = interaction.user.username;
    const userId = interaction.user.id;

    const faEmbed = new EmbedBuilder()
      .setColor(0x2f3136)
      .setDescription([
        `${userName}`,
        `${userName} (${userId})`,
        '',
        `${mensagem}`
      ].join('\n'))
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `BR4 (Brazilian Roblox 2024) • ${new Date().toLocaleDateString('pt-BR')}` })
      .setTimestamp();

    await interaction.editReply({ content: '✅ Seu anúncio de Free Agent foi publicado!' });

    try {
      const channel = await interaction.guild.channels.fetch(FA_ANNOUNCEMENT_CHANNEL);
      if (channel) {
        await channel.send({ embeds: [faEmbed] });
      }
    } catch (err) {
      console.error('❌ Erro ao enviar FA no canal de anúncios:', err);
    }
  }
};
