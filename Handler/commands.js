const { REST, Routes } = require('discord.js')
const { Collection } = require('discord.js')
const fs = require('fs').promises
const config = require('../config')
require('colors')

async function commandsHandler(client) {

    const rest = new REST({ version: '10' }).setToken(config.discord.token);
    const localSlashCommands = new Collection();
    const globalSlashCommands = new Collection();
    const loadedLocalCommands = [];
    const loadedGlobalCommands = [];

    try {

        const folders = await fs.readdir('./Commands')

        for (const folder of folders) {

            const files = await fs.readdir(`./Commands/${folder}/`)

            for (const file of files) {

                if (!file.endsWith('.js')) continue;

                const command = require(`../Commands/${folder}/${file}`)

                if (!command.data || !command.run) {

                    console.log(`⚠️ Comando "${file}" está incompleto`.yellow);

                    continue;

                }

                // Separando os comandos locais e globais
                if (command.data.guildOnly) {

                    localSlashCommands.set(command.data.name, command);
                    loadedLocalCommands.push(command.data.toJSON());

                } else {

                    globalSlashCommands.set(command.data.name, command);
                    loadedGlobalCommands.push(command.data.toJSON());

                }

            }

        }

        client.slashCommands = { local: localSlashCommands, global: globalSlashCommands };

        client.once('ready', async () => {

            const guildId = config.discord.guildId;
            const guild = client.guilds.cache.get(guildId);

            if (guild) {

                await syncCommands(guild, rest, Routes.applicationGuildCommands(config.discord.clientId, guildId), loadedLocalCommands, 'guild');

            } else {

                console.warn('⚠️ ID do servidor para comandos locais não encontrado'.yellow);

            }

            await syncCommands(null, rest, Routes.applicationCommands(config.discord.clientId), loadedGlobalCommands, 'global');

        });

    } catch (error) {

        console.error('Erro ao carregar comandos:', error);

    }

}

async function syncCommands(guild, rest, route, commands, scope) {

    try {

        console.log(`🔄 Sincronizando comandos ${scope}...`.cyan);

        // Busca os comandos existentes no destino (guild ou global)
        const existingCommands = await rest.get(route);

        const toRegister = [];
        let noNewCommands = true;

        for (const cmd of commands) {

            const existing = existingCommands.find(ec => ec.name === cmd.name);

            // Verifique se os comandos são iguais (comparação baseada no nome e na descrição)
            const isDifferent = !existing || existing.description !== cmd.description;

            if (isDifferent) {

                toRegister.push(cmd);
                noNewCommands = false; // Temos um comando novo ou alterado

            }

            //console.log("Comando existente:", existing);
            //console.log("Comando a ser registrado:", cmd);

        }

        // Registra apenas os comandos que precisam ser adicionados
        if (toRegister.length) {

            await rest.put(route, { body: toRegister });

            console.log(`✅ Comandos ${scope} registrados com sucesso!`.green);

        } else if (noNewCommands) {

            console.log(`📘 Nenhum novo comando ${scope} para registrar`.cyan);

        }

    } catch (error) {

        console.error(`❌ Erro ao sincronizar comandos ${scope}:`, error);

    }

}

module.exports = commandsHandler;