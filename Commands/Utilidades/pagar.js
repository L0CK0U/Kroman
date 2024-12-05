require('dotenv').config();
const { REST, Routes } = require('zoblox.js');
const OTP = require('otplib');
const noblox = require('noblox.js');
const { InteractionContextType, SlashCommandBuilder } = require('discord.js');

const getTOTP = () => OTP.authenticator.generate(process.env.TWOFACTOR);

class PayoutRequestBody {

    static create(userId, amount) {

        return {

            "PayoutType": "FixedAmount",
            "Recipients": [

                {

                    "recipientId": userId,
                    "recipientType": "User",
                    "amount": amount

                },

            ],

        };

    }

}

/** @type {import('zoblox.js').REST} */
let restInstance = null;

class Rest {

    static get instance() {

        if (!restInstance) {

            restInstance = new REST();

        }

        return restInstance;

    }

    static async setCookie() {

        await restInstance.setCookie(process.env.Cookie);

    }

}

class AsyncPayoutManager {

    static get Rest() {

        return Rest.instance;

    }

    static async UserPayoutEligibility(groupId, userId) {

        const { data } = await AsyncPayoutManager.Rest.get(`https://economy.roblox.com/v1/groups/${groupId}/users-payout-eligibility?userIds=${userId}`);

        return data.usersGroupPayoutEligibility?.[userId.toString()] ? true : false;

    }

    static async PayoutVerify(userId, challengeId, verificationCode, type = "authenticator") {

        const { data } = await AsyncPayoutManager.Rest.post(`https://twostepverification.roblox.com/v1/users/${userId}/challenges/${type}/verify`, {

            challengeId,
            actionType: "Generic",
            code: verificationCode,

        });

        return data.verificationToken;

    }

    static async Continue(challengeId, challengeMetaData) {

        const { data } = await AsyncPayoutManager.Rest.post('https://apis.roblox.com/challenge/v1/continue', {

            challengeId,
            challengeMetaData,
            challengeType: "twostepverification",

        });

        return data.challengeId;

    }

}

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

            const userId = await noblox.getIdFromUsername(username);
            const isEligible = await AsyncPayoutManager.UserPayoutEligibility(groupId, userId);

            if (!isEligible) {

                return interaction.reply({ content: `❌ O usuário ${username} não é elegível para pagamentos do grupo`});

            }

            const requestBody = PayoutRequestBody.create(userId, amount);

            await Rest.setCookie();

            try {

                await Rest.instance.post(Routes.groups.payouts(groupId), { data: requestBody });
                return interaction.reply({ content: `✅ Pagamento de ${amount} Robux enviado com sucesso para ${username}` });

            } catch (error) {

                const rblxChallengeId = error.response.headers['rblx-challenge-id'];
                const rblxChallengeMetadata = JSON.parse(Buffer.from(error.response.headers['rblx-challenge-metadata'], 'base64').toString());

                const verificationToken = await AsyncPayoutManager.PayoutVerify(userId, rblxChallengeMetadata.challengeId, getTOTP());
                const metadata = JSON.stringify({

                    verificationToken,
                    rememberDevice: false,
                    challengeId: rblxChallengeMetadata.challengeId,

                });

                await AsyncPayoutManager.Continue(rblxChallengeId, metadata);

                await Rest.instance.post(Routes.groups.payouts(groupId), { data: requestBody });

                return interaction.reply({ content: `✅ Pagamento de ${amount} Robux enviado com sucesso para ${username} após validação 2FA` });

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