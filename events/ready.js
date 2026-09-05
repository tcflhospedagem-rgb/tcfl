const { Events, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { loadContracts } = require('../systems/contracts');
const { loadTransferWindow } = require('../systems/transferWindow');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`✅ Bot online como: ${client.user.tag}`);

    // Carregar sistemas
    loadContracts(client);
    loadTransferWindow();

    client.user.setPresence({
      activities: [{ name: 'BR4 (Brazilian Roblox 2024)', type: 0 }],
      status: 'online'
    });

    // Registrar Slash Commands
    const commands = [];
    const commandsPath = path.join(__dirname, '../commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    client.commands = new Map();

    for (const file of commandFiles) {
      const command = require(path.join(commandsPath, file));
      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
      }
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commands }
      );
      console.log('✅ Slash commands registrados!');
    } catch (err) {
      console.error('Erro ao registrar commands:', err);
    }
  },
};
