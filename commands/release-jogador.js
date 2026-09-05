const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { ALLOWED_RELEASE_CHANNELS, ALLOWED_COMMAND_ROLES, ALLOWED_TEAM_ROLES, FREE_AGENT_ROLE_ID } = require('../config/constants');
const { activeContracts, saveContracts } = require('../systems/contracts');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('release-player')
    .setDescription('Liberar um jogador do seu time')
    .addUserOption(opt =>
      opt.setName('jogador')
        .setDescription('Jogador que será liberado')
        .setRequired(true)
    ),
  async execute(interaction, client) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!ALLOWED_RELEASE_CHANNELS.includes(interaction.channelId)) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('❌ Canal Não Permitido').setDescription('Este comando só pode ser utilizado em canais específicos.').setFooter({ text: 'BR4 (Brazilian Roblox 2024)' }).setTimestamp()]
      });
    }

    const hasCommandPermission = ALLOWED_COMMAND_ROLES.some(roleId => interaction.member.roles.cache.has(roleId));
    if (!hasCommandPermission) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('🔒 Sem Permissão').setDescription('Apenas membros com um cargo autorizado podem usar este comando.').setFooter({ text: 'BR4 (Brazilian Roblox 2024)' }).setTimestamp()]
      });
    }

    const technicianTeamRoles = ALLOWED_TEAM_ROLES.filter(roleId => interaction.member.roles.cache.has(roleId));
    if (technicianTeamRoles.length !== 1) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('❌ Time do Técnico Indefinido').setDescription('Você precisa ter exatamente um cargo de time autorizado para liberar jogadores.').setFooter({ text: 'BR4 (Brazilian Roblox 2024)' }).setTimestamp()]
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
        embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('❌ Jogador de Outro Time').setDescription('Você só pode liberar jogadores que tenham o mesmo cargo de time que você.').setFooter({ text: 'BR4 (Brazilian Roblox 2024)' }).setTimestamp()]
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
        }
      }
      saveContracts();
      await targetMember.roles.add(FREE_AGENT_ROLE_ID);

      const releaseEmbed = new EmbedBuilder()
        .setColor(0xf0c030)
        .setTitle('🔓 Você foi liberado do time!')
        .setDescription(`Você foi liberado de **${technicianTeamRole?.name || 'seu time'}** por ${interaction.user}.`)
        .addFields(
          { name: 'Time', value: technicianTeamRole?.name || 'N/A', inline: true },
          { name: 'Liberado por', value: interaction.user.username, inline: true },
          { name: 'Status', value: '🟡 Free Agent', inline: true },
        )
        .setFooter({ text: `BR4 (Brazilian Roblox 2024) • ${new Date().toLocaleDateString('pt-BR')}` })
        .setTimestamp();

      // Envia DM para o jogador liberado
      try {
        await targetUser.send({ embeds: [releaseEmbed] });
        console.log(`✅ DM de release enviada para ${targetUser.username}`);
      } catch (err) {
        console.log(`⚠️ Não foi possível enviar DM para ${targetUser.username}`);
      }

      await interaction.editReply({
        content: `✅ **${targetUser.username}** foi liberado de **${technicianTeamRole?.name}** e receberá uma DM de notificação.`
      });

    } catch (err) {
      console.error('❌ Erro ao liberar jogador:', err);
      await interaction.editReply({ content: '❌ Não foi possível liberar o jogador. Verifique se o bot pode gerenciar os cargos.' });
    }
  }
};
