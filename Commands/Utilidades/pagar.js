const { obterTokenCSRF, tryPayment, authenticateTwoFactor, verifyTwoFactorCode } = require('../../Handler/authentication');
const config = require('../../config');
const { InteractionContextType, SlashCommandBuilder } = require('discord.js');
const noblox = require('noblox.js');

module.exports = {

    data: new SlashCommandBuilder()
    
        .setName('pagar')
        .setDescription('Pagar usuário do roblox!')
        .setContexts(InteractionContextType.PrivateChannel)
        .addStringOption(option =>
            option.setName('player')
                .setDescription('Player do Roblox que receberá os Robux')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('quantidade')
                .setDescription('Quantidade de Robux')
                .setRequired(true)),

    async run(client, interaction) {

        const username = interaction.options.getString('player');
        const amount = interaction.options.getInteger('quantidade');
        const groupId = '15979531';

        if (interaction.user.id !== '693477503863488584') {
            return interaction.reply({ content: '❌ Apenas o proprietário pode usar este comando', ephemeral: true });
        }

        if (!amount || amount <= 0) {
            return interaction.reply({ content: '❌ O valor deve ser maior que 0', ephemeral: true });
        }

        try {

            // Passo 1: Obter CSRF token
            await obterTokenCSRF();

            // Passo 2: Autenticação 2FA
            const twoFactorAuthenticated = await authenticateTwoFactor();

            if (!twoFactorAuthenticated) {

                return interaction.editReply({ content: '❌ A autenticação 2FA falhou!' });

            }

            // Passo 3: Tentar realizar o pagamento
            const paymentResult = await tryPayment(amount, groupId, username);

            // Passo 4: Verificar se o pagamento foi bem-sucedido ou se é necessário um novo desafio
            if (paymentResult.status === 'pending') {

                const verificationToken = paymentResult.challengeId;
                console.log("🚨 Pagamento pendente! Precisamos verificar o código 2FA");

                // Passo 5: Verificar o código 2FA
                const isVerified = await verifyTwoFactorCode(username, verificationToken);

                if (!isVerified) {

                    return interaction.editReply({ content: '❌ Falha ao verificar o código 2FA' });

                }

                // Tentando novamente o pagamento após a verificação 2FA
                const finalResult = await tryPayment(amount, groupId, username);

                if (finalResult.status === 'success') {

                    return interaction.editReply({ content: `✅ Pagamento de ${amount} Robux enviado para ${username}` });

                } else {

                    return interaction.editReply({ content: '❌ Falha ao processar pagamento após verificação 2FA' });

                }

            } else if (paymentResult.status === 'success') {

                return interaction.editReply({ content: `✅ Pagamento de ${amount} Robux enviado para ${username}` });

            } else {

                return interaction.editReply({ content: '❌ Falha ao processar pagamento' });

            }

        } catch (error) {

            console.error('❌ Erro ao realizar o pagamento:', error);

            // Se o pagamento falhou devido a um erro de segurança ou outro motivo
            if (error.message.includes('Challenge')) {

                return interaction.editReply({

                    content: `❌ O pagamento foi bloqueado pelo Roblox devido a desafios de segurança. Certifique-se de que a conta esteja autorizada`,

                });

            }

            return interaction.editReply({

                content: `❌ Erro ao realizar o pagamento: ${error.message}`,

            });

        }

    },

};