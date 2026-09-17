import { eventModule, EventType, Service } from '@sern/handler';
import { Events } from 'discord.js';
import { handleSetupInteraction, handleFarmInteraction, handleWalletInteraction } from '#utils';

export default eventModule({
    name: Events.InteractionCreate,
    type: EventType.Discord,
    execute: interaction => {
        if (interaction.isButton() && interaction.customId.startsWith('farm-')) {
            return handleFarmInteraction(interaction, Service('prisma'));
        }
        if (interaction.isButton() && interaction.customId.startsWith('wallet-')) {
            return handleWalletInteraction(interaction, Service('prisma'));
        }
        if (interaction.isButton() || interaction.isChannelSelectMenu() || interaction.isRoleSelectMenu() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
            return handleSetupInteraction(interaction, { prisma: Service('prisma') });
        }
    }
});
