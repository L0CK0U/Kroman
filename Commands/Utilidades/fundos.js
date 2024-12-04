const { InteractionContextType, EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const noblox = require('noblox.js');
const cor = require('../../config').discord.color;

module.exports = {

    data: new SlashCommandBuilder()
        .setName('fundos')
        .setDescription('Veja os fundos do grupo!')
        .setContexts(InteractionContextType.PrivateChannel),

    async run (client, interaction) {

        /**
        const allowedUserId = '693477503863488584'

        if (interaction.user.id !== allowedUserId) {

            return interaction.reply({

                content: '❌ Apenas o proprietário pode usar este comando',
                ephemeral: true

            });

        }
        */

        const groupId = '15979531'

        try {

            await interaction.deferReply();

            const group = await noblox.getGroup(groupId);
            const funds = await noblox.getGroupFunds(groupId);
            //const pending = await noblox.getGroupRevenueSummary(groupId);
            const logo = await noblox.getLogo(groupId, '150x150', false, 'Png');

            const embed = new EmbedBuilder()
                .setColor(cor)
                .setAuthor({
                    name: group.name,
                    iconURL: logo
                })
                .addFields(
                    { name: 'Fundos do Grupo:', value: `<:Robux:1311957287178469447> **${funds}**`, inline: false },
                    //{ name: 'Fundos Pendentes:', value: `<:Clock:1311963949402689566> **${pending.pendingRobux}**`, inline: false }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {

            console.error(error);

            await interaction.editReply({

                content: '❌ Ocorreu um erro ao obter os fundos do grupo',
                ephemeral: true

            });

        }

    }

}