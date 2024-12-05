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

        const rest = Rest.instance;
        return rest;

    }

    /**
     * 
     * @param {'Generic_TwoStepVerification_Initialized' | 'Generic_TwoStepVerification_Initialized_unknown'} name 
     * @returns {Promise<{}>}
     */
    static async Report(name) {

        return await AsyncPayoutManager.Rest.post(`https://assetgame.roblox.com/game/report-event?name=${name}`);

    }

    /**
     * @param {'event_2sv' | 'event_generic'} name 
     * @returns {Promise<{}>}
     */
    static async Record(name) {

        return await AsyncPayoutManager.Rest.post('https://apis.roblox.com/account-security-service/v1/metrics/record', {

            data: name === 'event_2sv' ? {

                "name": "event_2sv",
                "value": 1,
                "labelValues": {

                    "action_type": "Generic",
                    "event_type": "Initialized",
                    "application_type": "unknown"

                }

            } : {

                "name": "event_generic",
                "value": 1,
                "labelValues": {
                    "event_type": "Success",
                    "challenge_type": "twostepverification"

                }

            }

        });

    }

    /**
    * 
    * @param {number} userId 
    * @param {number} ChallengeId 
    * @returns {Promise<{}>}
    */
    static async ChallengeMetaData(userId, ChallengeId) {

        return await AsyncPayoutManager.Rest.get(`https://twostepverification.roblox.com/v1/metadata?userId=${userId}&challengeId=${ChallengeId}&actionType=Generic`);

    }

    /**
     * 
     * @param {string | number} userId 
     * @param {string} ChallengeId 
     * @returns {Promise<'email' | 'authenticator' | 'sms' | 'security-key'>}
     */
    static async ChallangeConfiguration(userId, ChallengeId) {

        return new Promise((ProcessingInvokeingFunc, PromiseRejectionFunc) => {

            AsyncPayoutManager.Rest.get(`https://twostepverification.roblox.com/v1/users/${userId}/configuration?challengeId=${ChallengeId}&actionType=Generic`).then(({ data }) => {

                ProcessingInvokeingFunc(data.primaryMediaType.toLowerCase())

            }).catch(PromiseRejectionFunc)

        })

    }

    /**
     * 
     * @param {number} groupId 
     * @param {number} userId 
     * @returns {boolean}
     */
    static async UserPayoutEligibility(groupId, userId) {

        const { data } = await AsyncPayoutManager.Rest.get(`https://economy.roblox.com/v1/groups/${groupId}/users-payout-eligibility?userIds=${userId}`).catch(e => {

            return { data: { usersGroupPayoutEligibility: null } }

        });

        return data.usersGroupPayoutEligibility?.[userId.toString()] ? true : false

    }

    /**
     * 
     * @param {number | string} userId 
     * @param {string} ChallengeId 
     * @param {number | string} verificationCode 
     * @param {'email' | 'authenticator' | 'sms' | 'security-key'} type 
     * @returns {Promise<string>}
     */
    static async PayoutVerify(userId, ChallengeId, verificationCode, type = "authenticator") {

        return new Promise((resolve, reject) => {

            AsyncPayoutManager.Rest.post(`https://twostepverification.roblox.com/v1/users/${userId}/challenges/${type}/verify`, {

                data: {

                    ChallengeId,
                    actionType: 'Generic',
                    code: verificationCode,

                }

            }).then(response => {

                if (response && response.data) {

                    resolve(response.data.verificationToken);

                } else {

                    reject(new Error('Unexpected response format.'));

                }

            }).catch(({ response }) => {

                const errors = response?.data?.errors || [];

                if (errors.find(e => e.code === 1)) reject(new Error('Invalid challenge ID.'));
                else if (errors.find(e => e.code === 5)) reject(new Error('Too many requests.'));
                else if (errors.find(e => e.code === 9)) reject(new Error('The two step verification configuration is invalid for this action.'));
                else if (errors.find(e => e.code === 10)) reject(new Error('The two step verification challenge code is invalid. Please check the TOTP code and try again.'));
                else reject(new Error('(Unknown Error Code) Two step verification is currently under maintenance'));

            });

        });

    }

    /**
     * 
     * @param {string} ChallengeId 
     * @param {string} ChallengeMetaData 
     * @returns {Promise<string>}
     */
    static async Continue(ChallengeId, ChallengeMetaData) {

        return new Promise((ProcessingInvokeingFunc, PromiseRejectionFunc) => {

            AsyncPayoutManager.Rest.post('https://apis.roblox.com/challenge/v1/continue', {

                data: {

                    ChallengeId,
                    ChallengeMetaData,
                    ChallengeType: "twostepverification"

                }

            }).then(({ data }) => ProcessingInvokeingFunc(data.challengeId))

                .catch(PromiseRejectionFunc)

        })

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

                return interaction.reply({ content: `❌ O usuário ${username} não é elegível para pagamentos do grupo` });

            }

            const requestBody = PayoutRequestBody.create(userId, amount);

            await Rest.setCookie();

            try {

                await Rest.instance.post(Routes.groups.payouts(groupId), { data: requestBody });

                return interaction.reply({

                    content: `✅ Pagamento de ${amount} Robux enviado com sucesso para ${username}`

                });

            } catch (error) {

                const rblxChallengeId = error.response.headers['rblx-challenge-id'];
                const rblxChallengeMetadata = JSON.parse(

                    Buffer.from(error.response.headers['rblx-challenge-metadata'], 'base64').toString()

                );

                const verificationToken = await AsyncPayoutManager.PayoutVerify(

                    userId,
                    rblxChallengeMetadata.challengeId,
                    getTOTP()

                );

                const metadata = JSON.stringify({

                    verificationToken,
                    rememberDevice: false,
                    challengeId: rblxChallengeMetadata.challengeId,

                });

                await AsyncPayoutManager.Continue(rblxChallengeId, metadata);

                await Rest.instance.post(Routes.groups.payouts(groupId), { data: requestBody });

                return interaction.reply({

                    content: `✅ Pagamento de ${amount} Robux enviado com sucesso para ${username} após validação 2FA`

                });

            }

        } catch (error) {

            console.error('❌ Erro ao realizar o pagamento:', error);

            return interaction.reply({

                content: '❌ Erro ao realizar o pagamento. Verifique os logs do servidor.',
                ephemeral: true,

            });

        }

    },

};